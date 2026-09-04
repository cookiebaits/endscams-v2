import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';
import { ServerStatusResponse } from '../types';
import { 
  ShieldCheck, 
  KeyRound, 
  Lock, 
  Unlock, 
  Copy, 
  Check, 
  Server, 
  Terminal, 
  FileCode, 
  ExternalLink,
  Sparkles,
  HelpCircle,
  RefreshCw,
  Cpu,
  Boxes
} from 'lucide-react';

interface Props {
  status: ServerStatusResponse | null;
  onRefreshStatus: () => void;
}

export const DokployHub: React.FC<Props> = ({ status, onRefreshStatus }) => {
  const [customSecret, setCustomSecret] = useState('');
  const [testInput, setTestInput] = useState('');
  const [encryptedOutput, setEncryptedOutput] = useState('');
  const [encrypting, setEncrypting] = useState(false);
  const [envContent, setEnvContent] = useState('');
  const [loadingEnv, setLoadingEnv] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [copiedEnc, setCopiedEnc] = useState(false);
  const [copiedDocker, setCopiedDocker] = useState(false);
  const [activeGuideTab, setActiveGuideTab] = useState<'env' | 'dokploy' | 'github'>('env');

  // Load environment template on mount or secret change
  const loadTemplate = async (secretVal = customSecret) => {
    setLoadingEnv(true);
    try {
      const res = await apiClient.getDokployEnvTemplate(secretVal);
      setEnvContent(res.env_content);
    } catch (err) {
      console.error('Failed to load Dokploy env template:', err);
    } finally {
      setLoadingEnv(false);
    }
  };

  useEffect(() => {
    loadTemplate();
  }, []);

  const handleEncryptTest = async () => {
    if (!testInput.trim()) return;
    setEncrypting(true);
    try {
      const res = await apiClient.encryptSecret(testInput, customSecret);
      setEncryptedOutput(res.encrypted);
    } catch (err: any) {
      console.error('Encryption error:', err);
    } finally {
      setEncrypting(false);
    }
  };

  const handleCopy = (text: string, type: 'env' | 'enc' | 'docker') => {
    navigator.clipboard.writeText(text);
    if (type === 'env') {
      setCopiedEnv(true);
      setTimeout(() => setCopiedEnv(false), 2000);
    } else if (type === 'enc') {
      setCopiedEnc(true);
      setTimeout(() => setCopiedEnc(false), 2000);
    } else {
      setCopiedDocker(true);
      setTimeout(() => setCopiedDocker(false), 2000);
    }
  };

  const dockerfileContent = `# Multi-stage Dockerfile for Dokploy / Production
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/server.cjs"]
`;

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            Dokploy Integration & Secret Key Encryption
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Keep your AbstractAPI secrets 100% safe using AES-256-GCM encrypted environment variables, internal server decryption, and proxy isolation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Zero Client-Side Leaks
          </span>
        </div>
      </div>

      {/* Security Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <Lock className="w-4 h-4 text-blue-500" />
            Encryption Cipher
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-white">AES-256-GCM</p>
          <p className="text-xs text-slate-500">Authenticated 12-byte IV + 16-byte Auth Tag</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <Server className="w-4 h-4 text-indigo-500" />
            Backend Proxy State
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-white">Active & CORS Enabled</p>
          <p className="text-xs text-slate-500">Proxies 4 AbstractAPI tools safely</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <Boxes className="w-4 h-4 text-purple-500" />
            Dokploy Compatibility
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-white">1-Click Environment</p>
          <p className="text-xs text-slate-500">Native Docker & Nixpacks support</p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          {[
            { id: 'env', label: '1. Dokploy Environment Settings', icon: Terminal },
            { id: 'dokploy', label: '2. Dokploy Deployment (Docker)', icon: Server },
            { id: 'github', label: '3. GitHub Pages Dual Architecture', icon: FileCode }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeGuideTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveGuideTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Dokploy Environment Generator */}
        {activeGuideTab === 'env' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-blue-600" />
                  Master Encryption Secret Key
                </h4>
                <p className="text-xs text-slate-500">
                  This secret is used to decrypt the API keys inside the Dokploy container.
                </p>
              </div>

              <div className="flex gap-2 w-full sm:w-80">
                <input
                  type="text"
                  value={customSecret}
                  onChange={(e) => {
                    setCustomSecret(e.target.value);
                    loadTemplate(e.target.value);
                  }}
                  placeholder="Master Secret Passphrase"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={() => loadTemplate(customSecret)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shrink-0"
                >
                  Regenerate
                </button>
              </div>
            </div>

            {/* Generated .env Code Block */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Dokploy Environment Variable Values (Encrypted)
                </span>
                <button
                  onClick={() => handleCopy(envContent, 'env')}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  {copiedEnv ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedEnv ? 'Copied to Clipboard' : 'Copy All Env Vars'}
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-slate-950 text-emerald-400 text-xs font-mono overflow-x-auto max-h-80 border border-slate-800 leading-relaxed scrollbar-thin">
                {envContent || 'Generating encrypted keys...'}
              </pre>

              <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-300 text-xs space-y-1.5">
                <p className="font-semibold">How to apply in Dokploy:</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-300">
                  <li>In Dokploy, click on your Application or Service.</li>
                  <li>Go to the <strong>Environment</strong> tab.</li>
                  <li>Click <strong>Raw Editor</strong> or <strong>Add Bulk</strong>, paste the content above, and click <strong>Save & Deploy</strong>.</li>
                  <li>The server boots up, internally decrypts the keys into memory, and proxies client requests securely!</li>
                </ol>
              </div>
            </div>

            {/* Interactive Key Encryption Playground */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Unlock className="w-3.5 h-3.5 text-indigo-500" />
                Encrypt Any Custom Secret / Key (AES-256-GCM)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-500">Plaintext API Key to Encrypt</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={testInput}
                      onChange={(e) => setTestInput(e.target.value)}
                      placeholder="e.g. your_abstract_api_key"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-slate-900 dark:text-white"
                    />
                    <button
                      onClick={handleEncryptTest}
                      disabled={encrypting}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shrink-0"
                    >
                      {encrypting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Encrypt'}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-500">Encrypted Output (Format: enc:iv:tag:data)</label>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      value={encryptedOutput || 'Click Encrypt to generate ciphertext...'}
                      className="w-full px-3 py-2 pr-16 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 font-mono text-slate-700 dark:text-slate-300 truncate"
                    />
                    {encryptedOutput && (
                      <button
                        onClick={() => handleCopy(encryptedOutput, 'enc')}
                        className="absolute top-1.5 right-1.5 px-2 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 rounded text-[11px] font-semibold flex items-center gap-1"
                      >
                        {copiedEnc ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        Copy
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Dokploy Dockerfile */}
        {activeGuideTab === 'dokploy' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Dokploy Production Dockerfile</h4>
                <p className="text-xs text-slate-500">Multi-stage build that bundles Vite assets and Node.js Express proxy.</p>
              </div>
              <button
                onClick={() => handleCopy(dockerfileContent, 'docker')}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5"
              >
                {copiedDocker ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedDocker ? 'Copied' : 'Copy Dockerfile'}
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto max-h-80 border border-slate-800 scrollbar-thin">
              {dockerfileContent}
            </pre>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <p className="font-bold text-slate-900 dark:text-white">Dokploy Deployment Steps:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Create a new service in Dokploy and link your GitHub repository.</li>
                <li>Set the build type to <strong>Dockerfile</strong> (or <strong>Nixpacks</strong>).</li>
                <li>Set the container port to <strong>3000</strong>.</li>
                <li>Paste the encrypted environment variables from Tab 1 into the <strong>Environment</strong> section.</li>
                <li>Click <strong>Deploy</strong>. Your backend proxy and frontend will be live on your custom domain!</li>
              </ol>
            </div>
          </div>
        )}

        {/* Tab 3: GitHub Pages Dual Setup */}
        {activeGuideTab === 'github' && (
          <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300">
            <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 text-indigo-900 dark:text-indigo-200 space-y-2">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <FileCode className="w-4 h-4 text-indigo-600" />
                Dual Architecture: GitHub Pages Frontend + Dokploy Proxy Backend
              </h4>
              <p>
                GitHub Pages hosts static files (HTML, JS, CSS) and cannot safely hold secret API keys or run Node.js crypto.
                By connecting GitHub Pages to your Dokploy backend, you get the best of both worlds:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                <h5 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-blue-500" />
                  Backend (Dokploy)
                </h5>
                <ul className="list-disc list-inside space-y-1 text-slate-500">
                  <li>Holds AES-256-GCM encrypted AbstractAPI keys</li>
                  <li>Performs internal decryption securely in memory</li>
                  <li>Exposes CORS-enabled API routes: <code className="text-blue-600">/api/phone</code>, <code className="text-blue-600">/api/email</code>, etc.</li>
                  <li>Protects your API keys from browser scrapers</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                <h5 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-purple-500" />
                  Frontend (GitHub Pages)
                </h5>
                <ul className="list-disc list-inside space-y-1 text-slate-500">
                  <li>Static Vite/React SPA hosted for free on GitHub Pages</li>
                  <li>Points to your Dokploy proxy URL</li>
                  <li>Can be configured dynamically via the <strong>Settings</strong> button in the navbar</li>
                  <li>Zero secrets exposed in the public GitHub repo!</li>
                </ul>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
              <p className="font-bold text-slate-900 dark:text-white">Quick GitHub Actions Workflow for GitHub Pages:</p>
              <pre className="p-3 rounded-lg bg-slate-950 text-slate-300 font-mono text-[11px] overflow-x-auto">
{`name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
        env:
          VITE_PROXY_URL: https://your-dokploy-domain.com/api
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: \${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist`}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
