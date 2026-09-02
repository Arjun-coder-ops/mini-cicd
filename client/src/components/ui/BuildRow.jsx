import { useNavigate } from 'react-router-dom';
import { STATUS_ICON, fmtDuration, timeAgo } from '../../utils/helpers';

export default function BuildRow({ build, compact }) {
  const navigate = useNavigate();
  const s = build.status;

  return (
    <div onClick={() => navigate(`/builds/${build._id}`)}
      style={{
        display: 'grid',
        gridTemplateColumns: compact ? '80px 1fr 120px 80px' : '80px 1fr 140px 100px 90px',
        alignItems: 'center', gap: 14,
        padding: compact ? '10px 14px' : '13px 18px',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer', transition: 'background .13s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {/* Build number + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span className={`dot dot-${s}`} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>
          #{build.number}
        </span>
      </div>

      {/* Repo + commit */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>
          {build.repo}
          <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--blue)', fontFamily: 'var(--mono)' }}>
            {build.branch}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
          {build.commitShort || build.commit?.slice(0, 7)}
          {build.commitMsg && <span style={{ marginLeft: 6, fontFamily: 'var(--sans)', color: 'var(--text2)' }}>{build.commitMsg.slice(0, 50)}</span>}
        </div>
      </div>

      {/* Status badge */}
      <span className={`status status-${s}`}>
        {STATUS_ICON[s]} {s}
      </span>

      {/* Duration */}
      {!compact && (
        <span style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
          {fmtDuration(build.duration)}
        </span>
      )}

      {/* Time ago */}
      <span style={{ fontSize: 11, color: 'var(--text3)' }}>
        {timeAgo(build.createdAt)}
      </span>
    </div>
  );
}
