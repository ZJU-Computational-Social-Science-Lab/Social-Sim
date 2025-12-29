import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error: any;
};

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    // 打到控制台，方便你在浏览器 F12 里看
    console.error("React ErrorBoundary Caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, fontFamily: "monospace" }}>
          <h1>前端运行时出错（不是后端问题）</h1>
          <p style={{ color: "#b91c1c" }}>
            {String(this.state.error)}
          </p>
          <p style={{ marginTop: 16 }}>
            请把上面这行红字错误信息，或者浏览器控制台（Console）里红色那行，截图或复制给我。
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
