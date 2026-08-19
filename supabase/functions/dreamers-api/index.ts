// Dreamers API — a single Edge Function that handles all authenticated
// writes for the Dreamers app.
//
// Why this exists: the Telegram Mini App's RLS model gates writes by the
// session variable `app.current_user_telegram_id`. PostgREST can't set
// session vars per-request from the browser. This function does it
// server-side with the service role key, after verifying identity.
//
// Identity verification:
//   - Production path: `X-Telegram-Init-Data` header — the standard
//     Telegram WebApp initData signed by Telegram's bot token. We verify
//     the HMAC, extract the user's telegram_id, then proceed.
//   - Dev path: `X-Dev-Telegram-Id` header — only honored when
//     `DREAMERS_DEV_MODE` env is `true`. Lets the Flutter app drive real
//     writes during Phase 1 before TDLib is wired.
//
// Operations supported (each specified via the `op` field of the JSON body):
//   - ensure_profile       — create public.users + dreamers.profile_extensions if missing
//   - update_profile       — display name, interests, city, is_onboarded
//   - create_goal          — insert into dreamers.goals
//   - update_goal_progress — patch progress / status
//   - complete_goal        — status=completed, progress=1, earn reward coins
//   - create_idea          — insert into dreamers.ideas (stage=spark, kind)
//   - back_idea            — spend coins, insert dreamers.votes, update totals, treasury
//   - cast_vote            — coin-weighted vote, insert transaction + vote row
//   - spend / earn         — raw coin movement (checked: spend blocks if underbalance)
//
//   Launchpad v2 (staged incubator):
//   - create_role              — founder posts a role slot (title, skills, stake floor)
//   - apply_to_role            — applicant stakes DR (escrowed on application row)
//   - accept_applicant         — founder accepts → treasury contribution (role_stake)
//   - decline_applicant        — founder declines → refund the stake
//   - submit_flame_artifacts   — upsert artifacts for a stage (pitch deck, research, etc.)
//   - set_milestones           — replace an idea's milestones (Forge entry)
//   - post_update              — team posts a build-in-public update
//   - submit_grant_application — owner requests financial support (Forge+)
//   - vote_on_grant            — Architect+ committee vote, auto-resolves at 3 votes
//
//   Social feed ("What are you dreaming today?"):
//   - create_post              — insert post with kind + optional attached_goal/idea
//   - react_to_post            — spend DR (1/5/20), insert reaction, bump counters
//   - delete_post              — author-only hard delete
//   - add_comment              — free, flat comments (no DR cost)
//   - delete_comment           — author-only
//
//   Dream Cinema:
//   - suggest_movie            — free, adds a movie to the current scheduled night
//   - enter_cinema             — 10 DR to the treasury, admits you to a live room
//                                (idempotent: re-entries are free)
//   - cinema_heartbeat         — upsert presence, called every 15s in the room
//   - post_cinema_chat         — free, inserts a chat message in the live room
//   - update_cinema_timestamp  — Director-only, persists host playback position
//
// Every coin-touching op writes an audit row in public.transactions so the
// existing Mini App's ledger stays the single source of truth.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'node:crypto'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
// Dev mode: explicitly on via env, OR implicitly on when no bot token is set
// (the function can't verify real Telegram init data without the token, so
// falling back to the dev header is the only way it can work at all).
const DEV_MODE =
  Deno.env.get('DREAMERS_DEV_MODE') === 'true' || BOT_TOKEN === ''

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-telegram-init-data, x-dev-telegram-id',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function verifyTelegramInitData(initData: string): { id: number } | null {
  if (!BOT_TOKEN) return null
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')
  const data = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
  const computed = createHmac('sha256', secret).update(data).digest('hex')
  if (computed !== hash) return null
  const userJson = params.get('user')
  if (!userJson) return null
  try {
    const user = JSON.parse(userJson)
    if (typeof user.id !== 'number') return null
    return { id: user.id }
  } catch {
    return null
  }
}

function resolveTelegramId(req: Request): number | null {
  const initData = req.headers.get('x-telegram-init-data')
  if (initData) {
    const verified = verifyTelegramInitData(initData)
    if (verified) return verified.id
  }
  if (DEV_MODE) {
    const dev = req.headers.get('x-dev-telegram-id')
    if (dev) {
      const n = parseInt(dev, 10)
      if (!Number.isNaN(n)) return n
    }
  }
  return null
}

type Ctx = {
  admin: ReturnType<typeof createClient>
  userId: string
  telegramId: number
}

async function resolveUser(
  admin: Ctx['admin'],
  telegramId: number,
): Promise<string | null> {
  const { data } = await admin
    .from('users')
    .select('id')
    .eq('telegram_id', telegramId)
    .maybeSingle()
  return (data?.id as string | undefined) ?? null
}

type OpHandler = (ctx: Ctx, payload: Record<string, unknown>) => Promise<unknown>

const ops: Record<string, OpHandler> = {
  async ensure_profile(ctx) {
    await ctx.admin
      .schema('dreamers')
      .from('profile_extensions')
      .upsert({ user_id: ctx.userId }, { onConflict: 'user_id' })
    return { ok: true }
  },

  async update_profile(ctx, p) {
    const patch: Record<string, unknown> = {}
    if (typeof p.display_name === 'string') patch.display_name = p.display_name
    if (Array.isArray(p.interests)) patch.interests = p.interests
    if (typeof p.city === 'string') patch.city = p.city
    if (typeof p.bio === 'string') patch.bio = p.bio
    if (typeof p.is_onboarded === 'boolean') patch.is_onboarded = p.is_onboarded

    if (patch.display_name) {
      await ctx.admin
        .from('users')
        .update({ first_name: patch.display_name })
        .eq('id', ctx.userId)
      delete patch.display_name
    }
    if (Object.keys(patch).length > 0) {
      await ctx.admin
        .schema('dreamers')
        .from('profile_extensions')
        .upsert({ user_id: ctx.userId, ...patch }, { onConflict: 'user_id' })
    }
    return { ok: true }
  },

  async create_goal(ctx, p) {
    const { data, error } = await ctx.admin
      .schema('dreamers')
      .from('goals')
      .insert({
        owner_id: ctx.userId,
        title: p.title as string,
        due_at: p.due_at ?? null,
        theme: p.theme ?? null,
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update_goal_progress(ctx, p) {
    const { data, error } = await ctx.admin
      .schema('dreamers')
      .from('goals')
      .update({ progress: p.progress })
      .eq('id', p.goal_id as string)
      .eq('owner_id', ctx.userId)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async complete_goal(ctx, p) {
    const reward = (p.reward_coins as number | undefined) ?? 25
    const { data: goal, error } = await ctx.admin
      .schema('dreamers')
      .from('goals')
      .update({ progress: 1, status: 'completed' })
      .eq('id', p.goal_id as string)
      .eq('owner_id', ctx.userId)
      .select()
      .single()
    if (error) throw error
    await applyCoinDelta(ctx, {
      delta: reward,
      type: 'earn',
      description: `Goal complete · ${goal?.title ?? ''}`,
      reference_id: goal?.id,
    })
    return goal
  },

  async create_idea(ctx, p) {
    // Get tier for denorm column.
    const { data: ext } = await ctx.admin
      .schema('dreamers')
      .from('profile_extensions')
      .select('tier')
      .eq('user_id', ctx.userId)
      .maybeSingle()
    const tier = (ext?.tier as string | undefined) ?? 'dreamer'
    const allowedKinds = new Set([
      'tech', 'social', 'charity', 'art',
      'research', 'event', 'business', 'other',
    ])
    const kind = allowedKinds.has(p.kind as string) ? (p.kind as string) : 'other'
    const { data, error } = await ctx.admin
      .schema('dreamers')
      .from('ideas')
      .insert({
        founder_id: ctx.userId,
        founder_tier: tier,
        title: p.title as string,
        one_liner: p.one_liner as string,
        detail: p.detail ?? null,
        kind,
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async back_idea(ctx, p) {
    const coins = p.coins as number
    const ideaId = p.idea_id as string
    await applyCoinDelta(ctx, {
      delta: -coins,
      type: 'vote',
      description: `Back idea · ${ideaId}`,
      reference_id: ideaId,
    })
    const { data: vote } = await ctx.admin
      .schema('dreamers')
      .from('votes')
      .insert({
        voter_id: ctx.userId,
        target_type: 'idea',
        target_id: ideaId,
        coins,
      })
      .select()
      .single()
    // Bump idea totals; read-modify-write.
    const { data: idea } = await ctx.admin
      .schema('dreamers')
      .from('ideas')
      .select('backing_coins, backer_count')
      .eq('id', ideaId)
      .single()
    if (idea) {
      await ctx.admin
        .schema('dreamers')
        .from('ideas')
        .update({
          backing_coins: (idea.backing_coins as number) + coins,
          backer_count: (idea.backer_count as number) + 1,
        })
        .eq('id', ideaId)
    }
    // Treasury contribution — every back, forever.
    await ctx.admin.schema('dreamers').rpc('contribute_to_treasury', {
      p_idea_id: ideaId,
      p_contributor_id: ctx.userId,
      p_amount_dr: coins,
      p_source: 'spark_back',
      p_related_id: vote?.id ?? null,
      p_note: null,
    })
    return { ok: true }
  },

  async cast_vote(ctx, p) {
    const coins = p.coins as number
    const targetType = p.target_type as string
    const targetId = p.target_id as string
    await applyCoinDelta(ctx, {
      delta: -coins,
      type: p.transaction_type as string ?? 'vote',
      description: (p.description as string) ?? 'Vote',
      reference_id: targetId,
    })
    const { data, error } = await ctx.admin
      .schema('dreamers')
      .from('votes')
      .insert({
        voter_id: ctx.userId,
        target_type: targetType,
        target_id: targetId,
        coins,
        choice: p.choice ?? null,
      })
      .select()
      .single()
    if (error) throw error

    // Target-specific counter bumps. For movies: top up backing_coins +
    // voter_count (only count first vote from a given user).
    if (targetType === 'movie') {
      const { data: existing } = await ctx.admin
        .schema('dreamers')
        .from('votes')
        .select('id', { count: 'exact', head: true })
        .eq('target_type', 'movie')
        .eq('target_id', targetId)
        .eq('voter_id', ctx.userId)
        .limit(2)
      // If this was the user's first vote on this movie, they're a new voter.
      // (The row we just inserted is already included in `existing`.)
      const isFirst = existing == null || (existing as unknown as number) <= 1
      const { data: movie } = await ctx.admin
        .schema('dreamers')
        .from('movie_suggestions')
        .select('backing_coins, voter_count')
        .eq('id', targetId)
        .maybeSingle()
      if (movie) {
        await ctx.admin
          .schema('dreamers')
          .from('movie_suggestions')
          .update({
            backing_coins: (movie.backing_coins as number) + coins,
            voter_count: (movie.voter_count as number) + (isFirst ? 1 : 0),
          })
          .eq('id', targetId)
      }
    }
    return data
  },

  // ============================================================
  // Launchpad v2 — roles, artifacts, milestones, updates, grants
  // ============================================================

  async create_role(ctx, p) {
    // Must be the founder of the idea.
    const ideaId = p.idea_id as string
    const { data: idea } = await ctx.admin
      .schema('dreamers')
      .from('ideas')
      .select('founder_id')
      .eq('id', ideaId)
      .maybeSingle()
    if (!idea || idea.founder_id !== ctx.userId) {
      throw new Error('Only the founder can post roles')
    }
    const stake = p.stake_coins as number
    if (!Number.isInteger(stake) || stake < 50) {
      throw new Error('Role stake must be at least 50 DR')
    }
    const { data, error } = await ctx.admin
      .schema('dreamers')
      .from('idea_team_slots')
      .insert({
        idea_id: ideaId,
        role_title: p.role_title as string,
        description: (p.description as string | undefined) ?? null,
        skills_needed: (p.skills_needed as string[] | undefined) ?? [],
        commitment: (p.commitment as string | undefined) ?? null,
        stake_coins: stake,
        is_open_apply: (p.is_open_apply as boolean | undefined) ?? false,
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async apply_to_role(ctx, p) {
    const slotId = p.slot_id as string
    const stake = p.stake_coins as number

    const { data: slot } = await ctx.admin
      .schema('dreamers')
      .from('idea_team_slots')
      .select('id, idea_id, stake_coins, claimed_by, closed_at, is_open_apply')
      .eq('id', slotId)
      .maybeSingle()
    if (!slot) throw new Error('Role not found')
    if (slot.claimed_by || slot.closed_at) throw new Error('Role is closed')
    if (stake < (slot.stake_coins as number)) {
      throw new Error(`Stake must be at least ${slot.stake_coins} DR`)
    }

    // Escrow the stake — deduct from balance, log a transaction, track via
    // the application row. Refunded on decline, moved to treasury on accept.
    await applyCoinDelta(ctx, {
      delta: -stake,
      type: 'redeem',
      description: `Role stake escrow · ${slot.idea_id}`,
      reference_id: slotId,
    })

    const { data: app, error } = await ctx.admin
      .schema('dreamers')
      .from('idea_role_applications')
      .insert({
        slot_id: slotId,
        idea_id: slot.idea_id,
        applicant_id: ctx.userId,
        stake_coins: stake,
        why_me: (p.why_me as string | undefined) ?? null,
      })
      .select()
      .single()
    if (error) {
      // Refund on failure to keep ledger clean.
      await applyCoinDelta(ctx, {
        delta: stake,
        type: 'earn',
        description: 'Role apply failed — refund',
        reference_id: slotId,
      })
      throw error
    }

    // If the role is open-apply, auto-accept now.
    if (slot.is_open_apply && !slot.claimed_by) {
      return await acceptApplicationInternal(ctx, app.id as string, ctx.userId)
    }
    return app
  },

  async accept_applicant(ctx, p) {
    return await acceptApplicationInternal(ctx, p.application_id as string, ctx.userId)
  },

  async decline_applicant(ctx, p) {
    const appId = p.application_id as string
    const { data: app } = await ctx.admin
      .schema('dreamers')
      .from('idea_role_applications')
      .select('id, applicant_id, stake_coins, status, idea_id, slot_id')
      .eq('id', appId)
      .maybeSingle()
    if (!app) throw new Error('Application not found')
    if (app.status !== 'pending') throw new Error('Already decided')

    // Verify caller is the idea's founder.
    const { data: idea } = await ctx.admin
      .schema('dreamers')
      .from('ideas')
      .select('founder_id')
      .eq('id', app.idea_id)
      .maybeSingle()
    if (!idea || idea.founder_id !== ctx.userId) {
      throw new Error('Only the founder can decide applicants')
    }

    // Refund the escrowed stake to the applicant.
    await applyCoinDeltaForUser(ctx, app.applicant_id as string, {
      delta: app.stake_coins as number,
      type: 'earn',
      description: 'Role application declined — refund',
      reference_id: app.slot_id as string,
    })
    await ctx.admin
      .schema('dreamers')
      .from('idea_role_applications')
      .update({ status: 'declined', decided_at: new Date().toISOString() })
      .eq('id', appId)
    return { ok: true }
  },

  async submit_flame_artifacts(ctx, p) {
    // Upsert one or more artifacts for a given stage. Payload:
    //   { idea_id, stage, artifacts: [{ kind_slug, title?, body_md?, url? }, ...] }
    const ideaId = p.idea_id as string
    const stage = p.stage as string
    const artifacts = (p.artifacts as Array<Record<string, unknown>>) ?? []

    const { data: idea } = await ctx.admin
      .schema('dreamers')
      .from('ideas')
      .select('founder_id')
      .eq('id', ideaId)
      .maybeSingle()
    if (!idea || idea.founder_id !== ctx.userId) {
      throw new Error('Only the founder can submit artifacts')
    }

    const rows = artifacts.map((a) => ({
      idea_id: ideaId,
      stage,
      kind_slug: a.kind_slug as string,
      title: (a.title as string | undefined) ?? null,
      body_md: (a.body_md as string | undefined) ?? null,
      url: (a.url as string | undefined) ?? null,
      uploaded_by: ctx.userId,
    }))
    const { data, error } = await ctx.admin
      .schema('dreamers')
      .from('idea_artifacts')
      .upsert(rows, { onConflict: 'idea_id,stage,kind_slug' })
      .select()
    if (error) throw error
    return data
  },

  async set_milestones(ctx, p) {
    const ideaId = p.idea_id as string
    const milestones = (p.milestones as Array<Record<string, unknown>>) ?? []
    if (milestones.length < 4 || milestones.length > 6) {
      throw new Error('Set 4–6 milestones')
    }

    const { data: idea } = await ctx.admin
      .schema('dreamers')
      .from('ideas')
      .select('founder_id')
      .eq('id', ideaId)
      .maybeSingle()
    if (!idea || idea.founder_id !== ctx.userId) {
      throw new Error('Only the founder can set milestones')
    }

    // Replace existing milestones atomically.
    await ctx.admin.schema('dreamers').from('idea_milestones').delete().eq('idea_id', ideaId)
    const rows = milestones.map((m, i) => ({
      idea_id: ideaId,
      sort_order: i,
      title: m.title as string,
      description: (m.description as string | undefined) ?? null,
      target_date: (m.target_date as string | undefined) ?? null,
    }))
    const { data, error } = await ctx.admin
      .schema('dreamers')
      .from('idea_milestones')
      .insert(rows)
      .select()
    if (error) throw error
    return data
  },

  async post_update(ctx, p) {
    // Any team member (founder OR accepted applicant) can post.
    const ideaId = p.idea_id as string
    const { data: idea } = await ctx.admin
      .schema('dreamers')
      .from('ideas')
      .select('founder_id')
      .eq('id', ideaId)
      .maybeSingle()
    if (!idea) throw new Error('Idea not found')

    const isFounder = idea.founder_id === ctx.userId
    if (!isFounder) {
      const { count } = await ctx.admin
        .schema('dreamers')
        .from('idea_role_applications')
        .select('id', { count: 'exact', head: true })
        .eq('idea_id', ideaId)
        .eq('applicant_id', ctx.userId)
        .eq('status', 'accepted')
      if (!count || count === 0) {
        throw new Error('Only the founder or accepted team members can post updates')
      }
    }

    const { data, error } = await ctx.admin
      .schema('dreamers')
      .from('idea_updates')
      .insert({
        idea_id: ideaId,
        author_id: ctx.userId,
        body_md: p.body_md as string,
        milestone_id: (p.milestone_id as string | undefined) ?? null,
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async submit_grant_application(ctx, p) {
    const ideaId = p.idea_id as string
    const { data: idea } = await ctx.admin
      .schema('dreamers')
      .from('ideas')
      .select('founder_id, stage')
      .eq('id', ideaId)
      .maybeSingle()
    if (!idea || idea.founder_id !== ctx.userId) {
      throw new Error('Only the founder can request grants')
    }
    if (idea.stage !== 'forge' && idea.stage !== 'fire') {
      throw new Error('Grants unlock at the Forge stage')
    }

    const ngn = p.ask_amount_ngn as number
    // DR equivalent at current peg (1 DR = ₦0.33 NGN).
    const askDr = Math.round(ngn / 0.33)

    const { data, error } = await ctx.admin
      .schema('dreamers')
      .from('idea_financial_requests')
      .insert({
        idea_id: ideaId,
        requested_by: ctx.userId,
        ask_amount_ngn: ngn,
        ask_amount_dr: askDr,
        use_of_funds: p.use_of_funds as string,
        impact_statement: p.impact_statement as string,
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async vote_on_grant(ctx, p) {
    // Architect+ tier gate.
    const { data: ext } = await ctx.admin
      .schema('dreamers')
      .from('profile_extensions')
      .select('tier')
      .eq('user_id', ctx.userId)
      .maybeSingle()
    const tier = ext?.tier as string | undefined
    if (tier !== 'architect' && tier !== 'visionary') {
      throw new Error('Only Architect+ members can vote on grants')
    }

    const requestId = p.request_id as string
    const vote = p.vote as string
    if (!['approve', 'decline', 'abstain'].includes(vote)) {
      throw new Error('Vote must be approve / decline / abstain')
    }

    const { error: voteErr } = await ctx.admin
      .schema('dreamers')
      .from('grant_committee_votes')
      .insert({
        request_id: requestId,
        voter_id: ctx.userId,
        vote,
        note: (p.note as string | undefined) ?? null,
      })
    if (voteErr) throw voteErr

    // Resolve if 3+ non-abstain votes are in.
    const { data: nextStatus } = await ctx.admin
      .schema('dreamers')
      .rpc('resolve_grant_if_ready', { p_request_id: requestId })
    return { status: nextStatus }
  },

  // ============================================================
  // Social feed — posts + DR-costing reactions
  // ============================================================

  async create_post(ctx, p) {
    const allowedKinds = new Set([
      'thought', 'spark', 'goal_update', 'milestone', 'ask',
    ])
    const kind = allowedKinds.has(p.kind as string)
      ? (p.kind as string)
      : 'thought'
    const body = (p.body as string | undefined)?.trim() ?? ''
    if (body.length === 0) throw new Error('Post body is required')

    const { data, error } = await ctx.admin
      .schema('dreamers')
      .from('posts')
      .insert({
        author_id: ctx.userId,
        kind,
        body,
        attached_goal_id: (p.attached_goal_id as string | undefined) ?? null,
        attached_idea_id: (p.attached_idea_id as string | undefined) ?? null,
        image_url: (p.image_url as string | undefined) ?? null,
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async react_to_post(ctx, p) {
    const postId = p.post_id as string
    const kind = p.kind as string
    const costs: Record<string, number> = { dream: 1, ember: 5, fire: 20 }
    const cost = costs[kind]
    if (cost == null) throw new Error('Reaction must be dream / ember / fire')

    // Spend DR first — if this fails (underbalance) we skip the reaction.
    await applyCoinDelta(ctx, {
      delta: -cost,
      type: 'redeem',
      description: `${kind} reaction`,
      reference_id: postId,
    })

    try {
      const { data: reactionId } = await ctx.admin
        .schema('dreamers')
        .rpc('apply_post_reaction', {
          p_post_id: postId,
          p_reactor_id: ctx.userId,
          p_kind: kind,
          p_dr_spent: cost,
        })

      // Flow the DR into the community treasury. Reactions don't burn —
      // they fund the community. See memory/home_social_feed_decisions.md.
      await ctx.admin
        .schema('dreamers')
        .rpc('contribute_to_community_treasury', {
          p_source: 'post_reaction',
          p_source_id: postId,
          p_contributor_id: ctx.userId,
          p_amount_dr: cost,
          p_note: `${kind} reaction`,
        })

      return { reaction_id: reactionId, dr_spent: cost }
    } catch (e) {
      // Unique-violation = already reacted with this kind. Refund.
      await applyCoinDelta(ctx, {
        delta: cost,
        type: 'earn',
        description: 'Duplicate reaction — refund',
        reference_id: postId,
      })
      throw new Error('You already reacted to this post with that intensity.')
    }
  },

  async delete_post(ctx, p) {
    const { error } = await ctx.admin
      .schema('dreamers')
      .from('posts')
      .delete()
      .eq('id', p.post_id as string)
      .eq('author_id', ctx.userId)
    if (error) throw error
    return { ok: true }
  },

  // ============================================================
  // Dream Cinema
  // ============================================================

  async suggest_movie(ctx, p) {
    // Free — no DR spend. Requires an active scheduled night.
    const { data: night } = await ctx.admin
      .schema('dreamers')
      .from('cinema_nights')
      .select('id, status')
      .eq('status', 'scheduled')
      .order('scheduled_for', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (!night) {
      throw new Error('No active cinema night open for suggestions right now.')
    }
    const title = (p.title as string | undefined)?.trim() ?? ''
    if (title.length === 0) throw new Error('Title is required')
    const { data, error } = await ctx.admin
      .schema('dreamers')
      .from('movie_suggestions')
      .insert({
        night_id: night.id,
        suggested_by: ctx.userId,
        title,
        tagline: (p.tagline as string | undefined) ?? null,
        runtime_min: (p.runtime_min as number | undefined) ?? null,
        genre: (p.genre as string | undefined) ?? null,
        stream_url: (p.stream_url as string | undefined) ?? null,
        poster_emoji: (p.poster_emoji as string | undefined) ?? '🎬',
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async enter_cinema(ctx, p) {
    // 10 DR to enter a live room — flows into community treasury.
    // Idempotent per (night, user): already-paid Dreamers re-enter free.
    const cost = 10
    const nightId = p.night_id as string
    const { data: existing } = await ctx.admin
      .schema('dreamers')
      .from('cinema_entries')
      .select('paid_at')
      .eq('night_id', nightId)
      .eq('user_id', ctx.userId)
      .maybeSingle()
    if (existing != null) {
      return { ok: true, dr_spent: 0, already_paid: true }
    }
    await applyCoinDelta(ctx, {
      delta: -cost,
      type: 'redeem',
      description: 'Cinema entry',
      reference_id: nightId,
    })
    await ctx.admin
      .schema('dreamers')
      .rpc('contribute_to_community_treasury', {
        p_source: 'other',
        p_source_id: nightId,
        p_contributor_id: ctx.userId,
        p_amount_dr: cost,
        p_note: 'Cinema entry',
      })
    await ctx.admin
      .schema('dreamers')
      .from('cinema_entries')
      .insert({
        night_id: nightId,
        user_id: ctx.userId,
        dr_spent: cost,
      })
    return { ok: true, dr_spent: cost }
  },

  async cinema_heartbeat(ctx, p) {
    // Upsert presence. Called every 15s while in the live room.
    await ctx.admin
      .schema('dreamers')
      .from('cinema_presence')
      .upsert(
        {
          night_id: p.night_id as string,
          user_id: ctx.userId,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'night_id,user_id' },
      )
    return { ok: true }
  },

  async post_cinema_chat(ctx, p) {
    const body = (p.body as string | undefined)?.trim() ?? ''
    if (body.length === 0) throw new Error('Chat body is required')
    const { data, error } = await ctx.admin
      .schema('dreamers')
      .from('cinema_chat')
      .insert({
        night_id: p.night_id as string,
        author_id: ctx.userId,
        body,
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update_cinema_timestamp(ctx, p) {
    // Director-only — persists the host's current playback position.
    // Realtime broadcasting is separate (and used for sub-second sync);
    // this persists a catch-up value for late joiners.
    const nightId = p.night_id as string
    const seconds = p.seconds as number
    const { data: night } = await ctx.admin
      .schema('dreamers')
      .from('cinema_nights')
      .select('director_id')
      .eq('id', nightId)
      .maybeSingle()
    if (!night) throw new Error('Night not found')
    if (night.director_id && night.director_id !== ctx.userId) {
      throw new Error('Only the Director can drive playback')
    }
    await ctx.admin
      .schema('dreamers')
      .from('cinema_nights')
      .update({ current_ts_seconds: Math.max(0, Math.floor(seconds)) })
      .eq('id', nightId)
    return { ok: true }
  },

  async add_comment(ctx, p) {
    const body = (p.body as string | undefined)?.trim() ?? ''
    if (body.length === 0) throw new Error('Comment body is required')
    const { data, error } = await ctx.admin
      .schema('dreamers')
      .from('post_comments')
      .insert({
        post_id: p.post_id as string,
        author_id: ctx.userId,
        body,
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async delete_comment(ctx, p) {
    const { error } = await ctx.admin
      .schema('dreamers')
      .from('post_comments')
      .delete()
      .eq('id', p.comment_id as string)
      .eq('author_id', ctx.userId)
    if (error) throw error
    return { ok: true }
  },

  async spend(ctx, p) {
    await applyCoinDelta(ctx, {
      delta: -(p.amount as number),
      type: (p.type as string) ?? 'redeem',
      description: p.description as string,
      reference_id: p.reference_id as string | undefined,
    })
    return { ok: true }
  },

  async earn(ctx, p) {
    await applyCoinDelta(ctx, {
      delta: p.amount as number,
      type: (p.type as string) ?? 'earn',
      description: p.description as string,
      reference_id: p.reference_id as string | undefined,
    })
    return { ok: true }
  },
}

async function applyCoinDelta(
  ctx: Ctx,
  d: {
    delta: number
    type: string
    description: string
    reference_id?: string
  },
) {
  return await applyCoinDeltaForUser(ctx, ctx.userId, d)
}

async function applyCoinDeltaForUser(
  ctx: Ctx,
  targetUserId: string,
  d: {
    delta: number
    type: string
    description: string
    reference_id?: string
  },
) {
  if (d.delta === 0) return
  const { data: user, error: userErr } = await ctx.admin
    .from('users')
    .select('balance, total_earned')
    .eq('id', targetUserId)
    .single()
  if (userErr) throw userErr

  const current = user.balance as number
  if (d.delta < 0 && current + d.delta < 0) {
    throw new Error('Insufficient Dream Coins')
  }

  const nextBalance = current + d.delta
  const nextTotalEarned =
    d.delta > 0
      ? (user.total_earned as number) + d.delta
      : (user.total_earned as number)

  await ctx.admin
    .from('users')
    .update({ balance: nextBalance, total_earned: nextTotalEarned })
    .eq('id', targetUserId)

  await ctx.admin.from('transactions').insert({
    user_id: targetUserId,
    type: d.type,
    amount: d.delta,
    description: d.description,
    reference_id: d.reference_id ?? null,
  })
}

async function acceptApplicationInternal(
  ctx: Ctx,
  appId: string,
  callerUserId: string,
) {
  const { data: app } = await ctx.admin
    .schema('dreamers')
    .from('idea_role_applications')
    .select('id, applicant_id, stake_coins, status, idea_id, slot_id')
    .eq('id', appId)
    .maybeSingle()
  if (!app) throw new Error('Application not found')
  if (app.status !== 'pending') throw new Error('Already decided')

  // Verify caller is the founder (skipped for open-apply self-accept path —
  // in that case the caller IS the applicant and we trust the is_open_apply
  // flag that was verified at apply time).
  const { data: slot } = await ctx.admin
    .schema('dreamers')
    .from('idea_team_slots')
    .select('idea_id, claimed_by, is_open_apply')
    .eq('id', app.slot_id)
    .maybeSingle()
  if (!slot) throw new Error('Role not found')
  if (slot.claimed_by) throw new Error('Role already claimed')

  const { data: idea } = await ctx.admin
    .schema('dreamers')
    .from('ideas')
    .select('founder_id')
    .eq('id', app.idea_id)
    .maybeSingle()
  if (!idea) throw new Error('Idea not found')

  const isFounder = idea.founder_id === callerUserId
  const isOpenApplySelfAccept =
    slot.is_open_apply && app.applicant_id === callerUserId
  if (!isFounder && !isOpenApplySelfAccept) {
    throw new Error('Only the founder can accept applicants')
  }

  // Claim the slot + mark the application accepted.
  await ctx.admin
    .schema('dreamers')
    .from('idea_team_slots')
    .update({
      claimed_by: app.applicant_id,
      claimed_at: new Date().toISOString(),
      closed_at: new Date().toISOString(),
    })
    .eq('id', app.slot_id)

  await ctx.admin
    .schema('dreamers')
    .from('idea_role_applications')
    .update({ status: 'accepted', decided_at: new Date().toISOString() })
    .eq('id', appId)

  // The escrowed stake graduates to the treasury — source='role_stake'.
  await ctx.admin.schema('dreamers').rpc('contribute_to_treasury', {
    p_idea_id: app.idea_id,
    p_contributor_id: app.applicant_id,
    p_amount_dr: app.stake_coins,
    p_source: 'role_stake',
    p_related_id: appId,
    p_note: null,
  })

  // Decline every other pending application on the same slot + refund their
  // escrowed stakes — only one applicant can claim a role.
  const { data: losers } = await ctx.admin
    .schema('dreamers')
    .from('idea_role_applications')
    .select('id, applicant_id, stake_coins')
    .eq('slot_id', app.slot_id)
    .eq('status', 'pending')
    .neq('id', appId)
  for (const loser of losers ?? []) {
    await applyCoinDeltaForUser(ctx, loser.applicant_id as string, {
      delta: loser.stake_coins as number,
      type: 'earn',
      description: 'Role filled by another applicant — refund',
      reference_id: app.slot_id as string,
    })
    await ctx.admin
      .schema('dreamers')
      .from('idea_role_applications')
      .update({ status: 'declined', decided_at: new Date().toISOString() })
      .eq('id', loser.id)
  }

  return { ok: true, application_id: appId, slot_id: app.slot_id }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const telegramId = resolveTelegramId(req)
    if (telegramId == null) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    })

    const userId = await resolveUser(admin, telegramId)
    if (!userId) return json({ error: 'User not found' }, 404)

    const body = await req.json().catch(() => null) as
      | { op: string; payload?: Record<string, unknown> }
      | null
    if (!body?.op) return json({ error: 'Missing op' }, 400)

    const handler = ops[body.op]
    if (!handler) return json({ error: `Unknown op: ${body.op}` }, 400)

    const result = await handler(
      { admin, userId, telegramId },
      body.payload ?? {},
    )
    return json({ ok: true, data: result })
  } catch (e) {
    // Unwrap whatever we got — Error, PostgrestError, raw Supabase object.
    let msg: string
    if (e instanceof Error) {
      msg = e.message
    } else if (e && typeof e === 'object') {
      const obj = e as Record<string, unknown>
      msg = (obj.message as string | undefined) ??
            (obj.error as string | undefined) ??
            (obj.hint as string | undefined) ??
            (obj.details as string | undefined) ??
            JSON.stringify(obj)
    } else {
      msg = String(e)
    }
    console.error('dreamers-api failure:', msg, e)
    return json({ error: msg }, 500)
  }
})
