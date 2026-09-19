import { CheckCircle2, XCircle, LoaderCircle, Clock3, CircleStop, TimerOff } from 'lucide-react';

export default function StatusIcon({ status, size = 14, className = '', style = {} }) {
  const iconProps = {
    size,
    className: `${status === 'running' ? 'spin ' : ''}${className}`.trim(),
    style: { verticalAlign: 'middle', flexShrink: 0, ...style },
    'aria-hidden': 'true',
  };

  switch (status) {
    case 'success':
      return <CheckCircle2 {...iconProps} />;
    case 'failed':
      return <XCircle {...iconProps} />;
    case 'running':
      return <LoaderCircle {...iconProps} />;
    case 'queued':
      return <Clock3 {...iconProps} />;
    case 'cancelled':
      return <CircleStop {...iconProps} />;
    case 'timed_out':
      return <TimerOff {...iconProps} />;
    case 'pending':
    default:
      return <Clock3 {...iconProps} />;
  }
}
