import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TelegramProvider } from "@/contexts/TelegramContext";
import { UserProvider } from "@/contexts/UserContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { logError } from "@/lib/errorLogger";

if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    logError(event.reason, "frontend_unhandled", "unhandledrejection");
  });
  window.addEventListener("error", (event) => {
    logError(event.error ?? event.message, "frontend_unhandled", "window.onerror");
  });
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => logError(error, "frontend_query", query.queryHash),
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => logError(error, "frontend_mutation", mutation.options.mutationKey?.join(",")),
  }),
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TelegramProvider>
        <UserProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </UserProvider>
      </TelegramProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
