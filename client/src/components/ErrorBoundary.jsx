import React from 'react';
import { AlertTriangle, RefreshCw, Send, CheckCircle2 } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      reporting: false,
      reported: false,
      reportCount: null,
      reportSuccessMsg: ''
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, reported: false, reportCount: null, reportSuccessMsg: '' });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  handleSendErrorToAdmin = async () => {
    if (this.state.reporting || this.state.reported) return;
    this.setState({ reporting: true });

    try {
      const route = this.props.route || window.location.hash.replace('#', '') || 'unknown';
      const errorMessage = this.state.error?.message || 'Unknown runtime error';
      const errorStack = this.state.error?.stack || '';

      const res = await fetch('/api/v1/notifications/report-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route, errorMessage, errorStack })
      });
      const data = await res.json();

      if (data.success) {
        this.setState({
          reporting: false,
          reported: true,
          reportCount: data.data?.count || 1,
          reportSuccessMsg: `Error report sent to admin! Total recorded reports: ${data.data?.count || 1}. Admin has been notified.`
        });
      } else {
        this.setState({ reporting: false, reportSuccessMsg: 'Failed to send report. Please try again.' });
      }
    } catch (err) {
      console.error('Failed to report error to admin:', err);
      this.setState({ reporting: false, reportSuccessMsg: 'Network error reporting to admin.' });
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-5 animate-in fade-in duration-200">
          <div className="w-16 h-16 rounded-2xl bg-[#F43F5E]/15 border border-[#F43F5E]/30 flex items-center justify-center text-[#F43F5E] mx-auto shadow-lg shadow-[#F43F5E]/10">
            <AlertTriangle size={32} />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-white tracking-wide">
              There is an error in this page
            </h2>
            <p className="text-xs text-[#94A3B8] leading-relaxed max-w-md mx-auto">
              Other pages and workspaces remain fully operational. You can report this issue directly to the administrator or try reloading this page.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[#0D1524] border border-[#1F304E] text-left max-w-md mx-auto space-y-1">
            <p className="text-[10px] uppercase font-bold text-[#64748B] tracking-wider">Error Details</p>
            <p className="text-xs font-mono text-[#FB7185] break-words">
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
          </div>

          {this.state.reportSuccessMsg && (
            <div className="p-3 rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 text-[#34D399] text-xs flex items-center justify-center gap-2 max-w-md mx-auto font-medium">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{this.state.reportSuccessMsg}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#132238] border border-[#1F304E] text-white hover:bg-[#1A2D4A] hover:border-[#38BDF8]/40 transition-all flex items-center gap-2"
            >
              <RefreshCw size={14} />
              Reload Page
            </button>

            <button
              onClick={this.handleSendErrorToAdmin}
              disabled={this.state.reporting || this.state.reported}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md ${
                this.state.reported
                  ? 'bg-[#10B981]/20 border border-[#10B981]/40 text-[#34D399] cursor-default'
                  : 'bg-gradient-to-r from-[#F43F5E] to-[#E11D48] text-white hover:opacity-95 shadow-[#F43F5E]/20'
              }`}
            >
              <Send size={14} className={this.state.reporting ? 'animate-pulse' : ''} />
              <span>
                {this.state.reporting 
                  ? 'Sending to Admin...' 
                  : this.state.reported 
                  ? `Reported to Admin ✓ (${this.state.reportCount})` 
                  : 'Send Error to Admin'}
              </span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
