import React from 'react';
import { createRoot } from 'react-dom/client';

function EditorApp() {
  return <div>VTT Editor Skeleton</div>;
}

const root = createRoot(document.getElementById('root')!);
root.render(<EditorApp />);