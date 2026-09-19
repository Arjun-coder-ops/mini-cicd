import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  Webhook,
  Copy,
  Workflow,
  FolderGit2,
  Package,
  Hammer,
  FlaskConical,
  Rocket,
  Info,
  LoaderCircle,
} from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const STEP_ICONS = {
  clone: FolderGit2,
  install: Package,
  build: Hammer,
  test: FlaskConical,
  deploy: Rocket,
};

export default function TriggerPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ repo: '', branch: 'main', commit: 'HEAD' });
  const [loading, setLoading] = useState(false);
  const [webhookInfo, setWebhookInfo] = useState(false);

  const handleTrigger = async (e) => {
    e.preventDefault();
    if (!form.repo.trim()) { toast.error('Repository is required'); return; }
    if (!form.repo.includes('/')) { toast.error('Format must be owner/repo'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/builds/trigger', form);
      toast.success(`Build #${data.build.number} started!`);
      navigate(`/builds/${data.build._id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to trigger build');
    } finally { setLoading(false); }
  };

  const serverUrl = window.location.origin.replace('5174', '4000');

  return (
    <div className="fade-in" style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, fontFamily: 'var(--mono)' }}>Trigger Build</h1>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
          Manually start a pipeline or set up GitHub webhook auto-trigger
        </p>
      </div>

      {/* Manual trigger */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Play size={14} aria-hidden="true" /> Manual trigger
        </div>
        <form onSubmit={handleTrigger} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label">Repository</label>
            <input className="input" placeholder="e.g. facebook/react"
              value={form.repo}
              onChange={e => setForm(p => ({ ...p, repo: e.target.value }))}
              required />
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
              GitHub format: owner/repository-name
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Branch</label>
              <input className="input" placeholder="main"
                value={form.branch}
                onChange={e => setForm(p => ({ ...p, branch: e.target.value }))} />
            </div>
            <div>
              <label className="label">Commit SHA</label>
              <input className="input" placeholder="HEAD or full SHA"
                value={form.commit}
                onChange={e => setForm(p => ({ ...p, commit: e.target.value }))}
                style={{ fontFamily: 'var(--mono)' }} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}
            style={{ alignSelf: 'flex-start', padding: '9px 20px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {loading ? (
              <>
                <LoaderCircle size={14} className="spin" aria-hidden="true" /> Starting...
              </>
            ) : (
              <>
                <Play size={14} aria-hidden="true" /> Run pipeline
              </>
            )}
          </button>
        </form>
      </div>

      {/* GitHub webhook setup */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Webhook size={15} aria-hidden="true" /> GitHub webhook setup
          </div>
          <button onClick={() => setWebhookInfo(!webhookInfo)} className="btn btn-ghost"
            style={{ padding: '4px 10px', fontSize: 11 }}>
            {webhookInfo ? 'Hide' : 'Show'} guide
          </button>
        </div>

        <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>
            Webhook URL
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <code style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--cyan)', flex: 1 }}>
              {serverUrl}/api/webhook
            </code>
            <button className="btn btn-ghost"
              onClick={() => { navigator.clipboard.writeText(`${serverUrl}/api/webhook`); toast.success('Copied!'); }}
              style={{ padding: '4px 10px', fontSize: 11, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Copy size={12} aria-hidden="true" /> Copy
            </button>
          </div>
        </div>

        {webhookInfo && (
          <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { step: '1', title: 'Go to your GitHub repo', body: 'Settings → Webhooks → Add webhook' },
              { step: '2', title: 'Set Payload URL', body: `Paste: ${serverUrl}/api/webhook` },
              { step: '3', title: 'Content type', body: 'Set to: application/json' },
              { step: '4', title: 'Secret (optional)', body: 'Add a secret and set GITHUB_SECRET in your .env for security' },
              { step: '5', title: 'Events', body: 'Select "Just the push event"' },
              { step: '6', title: 'Save', body: 'Click "Add webhook". GitHub will send a ping — your server will respond 200 OK.' },
              { step: '7', title: 'For local dev', body: 'Use ngrok: ngrok http 4000 → copy the HTTPS URL as your webhook URL' },
            ].map(({ step, title, body }) => (
              <div key={step} style={{ display: 'flex', gap: 12, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 8 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--blue)', flexShrink: 0, marginTop: 1 }}>
                  {step}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>{title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: body.includes('ngrok') || body.includes('application') || body.includes('http') ? 'var(--mono)' : 'inherit' }}>{body}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* What happens during a build */}
      <div className="card">
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Workflow size={15} aria-hidden="true" /> What the pipeline does
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { step: 'clone',   desc: 'git clone --depth 1 your repo at the specified branch + commit' },
            { step: 'install', desc: 'npm ci (Node.js) or pip install -r requirements.txt (Python)' },
            { step: 'build',   desc: 'npm run build — skipped if no build script found' },
            { step: 'test',    desc: 'npm test — pipeline stops here if tests fail' },
            { step: 'deploy',  desc: 'rsync to VPS + pm2 restart — or simulation if DEPLOY_HOST not set' },
          ].map(({ step, desc }, i, arr) => {
            const Icon = STEP_ICONS[step] || Workflow;
            return (
              <div key={step} style={{
                display: 'flex', gap: 12, padding: '10px 0',
                borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                alignItems: 'center',
              }}>
                <Icon size={16} style={{ color: 'var(--cyan)', flexShrink: 0 }} aria-hidden="true" />
                <div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--cyan)' }}>{step}</span>
                  <span style={{ fontSize: 12, color: 'var(--text2)', marginLeft: 10 }}>{desc}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--blue-dim)', borderRadius: 8, border: '1px solid rgba(91,156,246,.15)', fontSize: 12, color: 'var(--blue)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <Info size={15} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <div>
            Set <code style={{ fontFamily: 'var(--mono)' }}>DEPLOY_HOST</code>, <code style={{ fontFamily: 'var(--mono)' }}>DEPLOY_USER</code>, <code style={{ fontFamily: 'var(--mono)' }}>DEPLOY_PATH</code> and <code style={{ fontFamily: 'var(--mono)' }}>DEPLOY_KEY_PATH</code> in <code style={{ fontFamily: 'var(--mono)' }}>server/.env</code> to enable real deployment. Without these, the deploy step runs in simulation mode.
          </div>
        </div>
      </div>
    </div>
  );
}
