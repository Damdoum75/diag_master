export default function Layout({ children, currentPageName }) {
  return (
    <div style={{ minHeight: "100vh", background: "#010409" }}>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; background: #010409; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #0D1117; }
        ::-webkit-scrollbar-thumb { background: #21262D; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #30363D; }
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
      `}</style>
      {children}
    </div>
  );
}
