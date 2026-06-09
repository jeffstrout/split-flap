import React from 'react';
import '../styles/qlock.css';

// Placeholder QLOCKTWO word-clock component.
// The full letter-matrix renderer is implemented in issue #10 (FR-27, FR-30,
// FR-32, FR-33, FR-34). For now this renders a centered placeholder so mode
// switching (issue #8) can be exercised end-to-end.
function QlockTwo({ theme }) {
  return (
    <div className={`qlock ${theme === 'light' ? 'theme-light' : ''}`}>
      <div className="qlock-placeholder">QLOCKTWO</div>
    </div>
  );
}

export default QlockTwo;
