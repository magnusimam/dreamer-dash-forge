import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          background: "#0E0E0E",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            background: "linear-gradient(135deg, #FFD700, #FFA500)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 16, fontSize: 20, fontWeight: "bold", color: "#000",
          }}>DR</div>
          <h2 style={{ marginBottom: 8, fontSize: 18 }}>Something went wrong</h2>
          <p style={{ color: "#888", fontSize: 14, marginBottom: 16 }}>{this.state.error}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "#FFD700", color: "#000", border: "none",
              padding: "10px 24px", borderRadius: 8, fontWeight: "bold",
              cursor: "pointer", fontSize: 14,
            }}
          >Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}
