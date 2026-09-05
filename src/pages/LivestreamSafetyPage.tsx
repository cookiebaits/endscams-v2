import { useState, useEffect } from 'react';
import { Shield, ChevronDown, ChevronUp, AlertTriangle, MonitorPlay, Video, VideoOff, Key, XOctagon, ExternalLink, Link2, MessageSquare, Lock } from 'lucide-react';
import Banner from '../components/Banner';

const SCAM_CATALOG = [
  {
    id: 'fake-sponsorship',
    title: 'Fake Sponsorships & Brand Deals',
    threat: 'Critical',
    threatColor: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-500 border-red-300 dark:border-red-500/30',
    vector: 'Email, Twitter/X DMs',
    pitch: 'A well-known brand (often gaming or tech related) reaches out with a lucrative sponsorship offer. They ask you to download a "game launcher", "asset pack", or "contract" (often a password-protected ZIP, .scr, or .exe file).',
    tactic: 'The downloaded file contains a stealthy infostealer malware (like RedLine or Raccoon). It bypasses 2FA by stealing active session tokens from your browser and immediately hijacking your YouTube/Twitch/Twitter accounts.',
    defense: 'Never download unsolicited executables or password-protected ZIPs. Verify the sender domain carefully (e.g., @brand.com vs @brand-collab.com). When in doubt, run suspicious files in a cloud sandbox like Any.Run.'
  },
  {
    id: 'discord-playtest-scam',
    title: 'Discord Game Playtest & "Join My Game" Scams',
    threat: 'Critical',
    threatColor: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-500 border-red-300 dark:border-red-500/30',
    vector: 'Discord DMs, Server Chat',
    pitch: 'An acquaintance or stranger asks: "Hey, I\'m developing an indie game, could you test it out on stream or give feedback?" or "Want to join my game/lobby real quick?" and sends a link or ZIP file.',
    tactic: 'The file contains a Discord token grabber and infostealer malware disguised as a game executable (or Steam installer). Upon execution, it silently dumps saved browser credentials, Discord tokens, and session cookies, hijacking your accounts instantly.',
    defense: 'NEVER execute `.exe`, `.scr`, `.bat`, `.py`, or `.zip` files sent directly over Discord or from unknown devs. Real indie developers distribute games through established platforms like Steam, itch.io, or GOG—not random direct download links.'
  },
  {
    id: 'discord-server-tournament-scam',
    title: 'Discord "Join My Server" & Verification Bot Phishing',
    threat: 'High',
    threatColor: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
    vector: 'Discord DMs, Server Invites',
    pitch: 'You receive an invite to "help test my new Discord server", vote for a competitive team in a tournament, or verify your account using a custom verification bot in a server.',
    tactic: 'The verification bot requires you to scan a QR code with your mobile Discord app or sign in through a fake OAuth portal. Scanning the QR code or authorizing malicious permissions grants the scammer full access to your Discord account or OAuth permissions.',
    defense: 'Never scan Discord login QR codes on screen or for "verification". Check Discord User Settings -> Sessions / Authorized Apps to remove unknown devices, and disable "Allow direct messages from server members" in your Privacy & Safety settings.'
  },
  {
    id: 'fake-game-keys',
    title: 'Fake Game Keys / Phishing',
    threat: 'Moderate',
    threatColor: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    vector: 'Discord DMs, Email',
    pitch: 'Someone claiming to be an indie developer or PR firm offers you early access or free keys to a new game. They send a link to a fake login portal or a suspicious file download.',
    tactic: 'Social engineering and credential harvesting. If a link, it\'s a pixel-perfect clone of a Steam/Twitch login page designed to steal your username, password, and 2FA code.',
    defense: 'Hover over links to check the actual URL. Never log into an external site to "claim" a key. Real keys are either sent as plain text codes or distributed via verified platforms like Keymailer or Terminals.'
  },
  {
    id: 'oauth-token-hijack',
    title: 'OAuth Permission Abuse & Abandoned Integrations',
    threat: 'High',
    threatColor: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
    vector: 'Third-party Creator Tools, Overlays, Chatbots',
    pitch: 'You log into a third-party streamer tool, giveaway manager, chatbot, or analytics service using "Sign in with Twitch" or "Sign in with YouTube".',
    tactic: 'Over time, if that service is compromised, acquired by malicious actors, or granted broad channel editing scope, attackers can exploit valid long-lived OAuth tokens to edit your stream details, initiate unauthorized broadcasts, or extract channel telemetry without needing your password or 2FA.',
    defense: 'Regularly audit connected applications on Twitch and YouTube. Unlink and revoke access for any legacy, unmaintained, or unused third-party integration.'
  },
  {
    id: 'chargeback-abuse',
    title: 'Chargeback / Donation Abuse',
    threat: 'Low',
    threatColor: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
    vector: 'Stream Chat / Donations',
    pitch: 'A viewer drops a massive, unexpected donation during your stream, often accompanied by hype or requests for attention.',
    tactic: 'Months later, the "donor" files a chargeback with their credit card company claiming the transaction was unauthorized. The streamer is hit with losing the money AND paying hefty chargeback dispute fees (often $15-$20 per transaction).',
    defense: 'Use platforms that offer chargeback protection (like certain Streamlabs/StreamElements tiers). Keep funds from suspiciously large, unknown donors isolated in your account for 180 days before spending.'
  },
  {
    id: 'copyright-extortion',
    title: 'Fake Copyright Strikes / Extortion',
    threat: 'Moderate',
    threatColor: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    vector: 'Email',
    pitch: 'You receive an urgent, official-looking email claiming your channel is about to be suspended for a copyright violation unless you click a link to "appeal" or pay a fine.',
    tactic: 'Phishing. The link goes to a fake login page to steal credentials, or contains ransomware/malware payloads.',
    defense: 'Ignore emails. Only check for copyright strikes directly inside your YouTube Studio or Twitch Creator Dashboard. Real platforms do not use external links for dispute resolution.'
  }
];

export default function LivestreamSafetyPage() {
  const [expandedScam, setExpandedScam] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const saved = localStorage.getItem('stream_security_checklist');
    if (saved) {
      try {
        setChecklist(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse checklist', e);
      }
    }
  }, []);

  const toggleCheck = (id: string) => {
    const next = { ...checklist, [id]: !checklist[id] };
    setChecklist(next);
    localStorage.setItem('stream_security_checklist', JSON.stringify(next));
  };

  const toggleScam = (id: string) => {
    setExpandedScam(prev => prev === id ? null : id);
  };

  const CHECKLIST_ITEMS = [
    { id: 'obs-display', label: 'OBS Display Capture disabled / Window capture verified' },
    { id: 'discord-streamer', label: 'Discord Streamer Mode active & DMs from unknown members restricted' },
    { id: 'tabs-closed', label: 'Business and personal email tabs closed' },
    { id: 'api-hidden', label: 'Sensitive overlays / API keys hidden from view' },
    { id: 'oauth-audited', label: 'Twitch & YouTube connected OAuth applications reviewed and unlinked if unused' },
    { id: 'discord-sessions', label: 'Discord active sessions and authorized apps audited' },
    { id: 'mods-ready', label: 'Mod bot filters and chat automations active' },
    { id: 'notifications', label: 'Desktop push notifications disabled (DND mode)' },
  ];

  return (
    <>
      <Banner
        variant="info"
        id="streamer_safety"
        dismissible
        message={<span><strong>Streamer Safety:</strong> High-profile creators are prime targets. Keep your personal data strictly separated from your public presence.</span>}
      />
      <div className="max-w-4xl mx-auto px-4 pt-8 pb-12">
        <div className="text-center mb-14">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-500/10 mb-6">
            <MonitorPlay className="w-8 h-8 text-brand-500" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white">
            Livestreaming Safety & Security Field Guide
          </h1>
        </div>

      {/* Module 1: Comprehensive Scam Catalog */}
      <div id="scam-catalog" className="mb-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <Shield className="w-6 h-6 text-brand-500" />
          Comprehensive Scam Catalog
        </h2>
        <div className="space-y-4">
          {SCAM_CATALOG.map((scam) => {
            const isExpanded = expandedScam === scam.id;
            return (
              <div key={scam.id} className={`card overflow-hidden transition-all duration-300 border ${isExpanded ? 'border-brand-500/50' : 'border-slate-200 dark:border-slate-800'}`}>
                <button
                  onClick={() => toggleScam(scam.id)}
                  className="w-full flex items-center justify-between p-5 bg-slate-100 dark:bg-slate-900/50 hover:bg-slate-800/80 transition-colors text-left"
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-center gap-4">
                    <span className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-md border ${scam.threatColor}`}>
                      {scam.threat}
                    </span>
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg">{scam.title}</h3>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <div className="mb-4">
                          <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">Attack Vector</h4>
                          <p className="text-slate-700 dark:text-slate-300 text-sm">{scam.vector}</p>
                        </div>
                        <div className="mb-4">
                          <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">The Scam Pitch</h4>
                          <p className="text-slate-700 dark:text-slate-300 text-sm">{scam.pitch}</p>
                        </div>
                      </div>
                      <div>
                        <div className="mb-4">
                          <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">Scammer Tactic & Payload</h4>
                          <p className="text-slate-700 dark:text-slate-300 text-sm">{scam.tactic}</p>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider mb-1">Defensive Action</h4>
                          <p className="text-slate-700 dark:text-slate-300 text-sm font-medium">{scam.defense}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Module: OAuth Connections & Tool Permissions Management */}
      <div id="oauth-security" className="mb-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <Link2 className="w-6 h-6 text-brand-500" />
          OAuth Connections & Third-Party Tool Auditing
        </h2>
        <div className="card p-6 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 space-y-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="p-3 rounded-lg bg-brand-500/10 text-brand-500 flex-shrink-0">
              <Lock className="w-8 h-8" />
            </div>
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Why Auditing Third-Party Logins is Critical
              </h3>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                Streamers frequently use <strong>"Sign in with Twitch"</strong> or <strong>"Sign in with Google/YouTube"</strong> to grant permissions to overlay widgets, stream bots, analytics suites, and giveaway managers. However, every authorized OAuth application maintains active tokens that allow external servers to access or modify your account.
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                If a legacy tool is shut down, acquired, or suffers a data breach, attackers can exploit valid OAuth tokens to alter your channel metadata, run unauthorized streams, or steal personal information—<strong>even if you change your password or have 2FA enabled</strong>.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-slate-200 dark:border-slate-800">
            {/* Twitch OAuth Card */}
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-purple-500 inline-block" />
                    Twitch OAuth Connections
                  </h4>
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium">
                    Twitch Account
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                  Review all third-party applications authorized to access your Twitch account (chatbots, overlays, extension panel tools). Disconnect any tool you no longer actively use.
                </p>
              </div>
              <a
                href="https://www.twitch.tv/settings/connections"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm transition-colors shadow-sm"
              >
                Manage Twitch Connections
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            {/* YouTube / Google OAuth Card */}
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                    YouTube & Google Connected Apps
                  </h4>
                  <span className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 font-medium">
                    Google Account
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                  Inspect third-party apps with account permissions, third-party sign-ins, and connected services. Revoke permissions for unverified or obsolete software.
                </p>
              </div>
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition-colors shadow-sm"
              >
                Manage Google Permissions
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Module 2: Streamer OPSEC & Software Hardening Matrix */}
      <div id="opsec-matrix" className="mb-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <Key className="w-6 h-6 text-brand-500" />
          Streamer OPSEC & Software Hardening Matrix
        </h2>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="card p-6 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-brand-500/30 transition-colors">
            <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-4 flex items-center gap-2">
              <Video className="w-5 h-5 text-blue-400" />
              Broadcast Safety
            </h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Shield className="w-4 h-4 text-brand-500 mt-1 flex-shrink-0" />
                <p className="text-sm text-slate-700 dark:text-slate-300"><strong>Use Window Capture:</strong> Avoid Display Capture whenever possible. If required, always disable desktop icons and hide the taskbar.</p>
              </li>
              <li className="flex items-start gap-3">
                <Shield className="w-4 h-4 text-brand-500 mt-1 flex-shrink-0" />
                <p className="text-sm text-slate-700 dark:text-slate-300"><strong>Dedicated Profiles:</strong> Use a separate browser profile specifically for streaming, completely isolated from your personal emails and banking.</p>
              </li>
              <li className="flex items-start gap-3">
                <Shield className="w-4 h-4 text-brand-500 mt-1 flex-shrink-0" />
                <p className="text-sm text-slate-700 dark:text-slate-300"><strong>Notification Silence:</strong> Use "Do Not Disturb" on Windows/Mac to block push notifications that might reveal personal info or 2FA codes on stream.</p>
              </li>
            </ul>
          </div>

          <div className="card p-6 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-brand-500/30 transition-colors">
            <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-purple-400" />
              Discord & Community OPSEC
            </h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Shield className="w-4 h-4 text-brand-500 mt-1 flex-shrink-0" />
                <p className="text-sm text-slate-700 dark:text-slate-300"><strong>Disable Unknown DMs:</strong> Turn off "Allow direct messages from server members" in Discord Privacy & Safety settings to block unsolicited scam messages.</p>
              </li>
              <li className="flex items-start gap-3">
                <Shield className="w-4 h-4 text-brand-500 mt-1 flex-shrink-0" />
                <p className="text-sm text-slate-700 dark:text-slate-300"><strong>Audit Discord Sessions:</strong> Regularly navigate to <em>User Settings -&gt; Devices / Sessions</em> to log out of old mobile devices or web browsers.</p>
              </li>
              <li className="flex items-start gap-3">
                <Shield className="w-4 h-4 text-brand-500 mt-1 flex-shrink-0" />
                <p className="text-sm text-slate-700 dark:text-slate-300"><strong>Never Scan QR Logins:</strong> Discord QR codes instantly log the scanning device into your account. Never scan a QR code shown in a stream or sent in chat.</p>
              </li>
            </ul>
          </div>

          <div className="card p-6 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-brand-500/30 transition-colors">
            <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-4 flex items-center gap-2">
              <Key className="w-5 h-5 text-yellow-400" />
              Account Security
            </h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Shield className="w-4 h-4 text-brand-500 mt-1 flex-shrink-0" />
                <p className="text-sm text-slate-700 dark:text-slate-300"><strong>Hardware 2FA (FIDO):</strong> Migrate to hardware keys (YubiKey, Titan) for Google, Twitter, Twitch. Deprecate SMS 2FA to prevent SIM-swapping.</p>
              </li>
              <li className="flex items-start gap-3">
                <Shield className="w-4 h-4 text-brand-500 mt-1 flex-shrink-0" />
                <p className="text-sm text-slate-700 dark:text-slate-300"><strong>Email Segmentation:</strong> Maintain strictly separated email addresses: one for public business inquiries, one for private platform logins.</p>
              </li>
              <li className="flex items-start gap-3">
                <Shield className="w-4 h-4 text-brand-500 mt-1 flex-shrink-0" />
                <p className="text-sm text-slate-700 dark:text-slate-300"><strong>Password Managers:</strong> Use a robust password manager and never store streaming-related passwords in your browser's auto-fill.</p>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Module 3: Live Incident Response Playbook */}
      <div id="incident-playbook" className="mb-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <AlertTriangle className="w-6 h-6 text-red-700 dark:text-red-500" />
          Live Incident Response Playbook
        </h2>
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 dark:bg-red-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />

          <p className="text-red-700 dark:text-red-200 mb-6 font-medium">If your screen flashes personal info, a malicious link is opened, or you suspect active hijacking mid-stream, execute these steps immediately:</p>

          <div className="space-y-4 relative z-10">
            <div className="flex items-start gap-4 p-4 bg-red-50 dark:bg-red-950/40 rounded-lg border border-red-200 dark:border-red-500/20">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5 border border-red-300 dark:border-red-500/30">
                <VideoOff className="w-5 h-5 text-red-700 dark:text-red-500" />
              </div>
              <div>
                <h4 className="text-slate-900 dark:text-white font-bold text-lg mb-1">Step 1: The Panic Scene (Kill Visuals)</h4>
                <p className="text-red-700 dark:text-red-200/80 text-sm">Hit your pre-configured OBS hotkey to switch to an emergency "BRB / Tech Issues" scene. This scene MUST have desktop audio, mic audio, and display capture fully muted/disabled.</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-red-50 dark:bg-red-950/40 rounded-lg border border-red-200 dark:border-red-500/20">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5 border border-red-300 dark:border-red-500/30">
                <Key className="w-5 h-5 text-red-700 dark:text-red-500" />
              </div>
              <div>
                <h4 className="text-slate-900 dark:text-white font-bold text-lg mb-1">Step 2: Credential Revocation</h4>
                <p className="text-red-700 dark:text-red-200/80 text-sm">If a session token was stolen (e.g., clicked a bad link), immediately log out of all active sessions on your platform (Twitch/YouTube). Reset your password and invalidate your Stream Key from a separate, secure device (like your phone) if possible.</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-red-50 dark:bg-red-950/40 rounded-lg border border-red-200 dark:border-red-500/20">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5 border border-red-300 dark:border-red-500/30">
                <XOctagon className="w-5 h-5 text-red-700 dark:text-red-500" />
              </div>
              <div>
                <h4 className="text-slate-900 dark:text-white font-bold text-lg mb-1">Step 3: VOD & Clip Isolation</h4>
                <p className="text-red-700 dark:text-red-200/80 text-sm">Before ending the broadcast, unpublish or delete the current active stream VOD. Have your trusted moderators immediately delete any clips created in the last 10 minutes to prevent the leak from spreading.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Module 4: Interactive Pre-Stream Security Checklist */}
      <div id="pre-stream-checklist" className="mb-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <Shield className="w-6 h-6 text-brand-500" />
          Interactive Pre-Stream Security Checklist
        </h2>
        <div className="card p-6 bg-white dark:bg-slate-900/80">
          <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">Review this checklist before going live to ensure maximum OPSEC. Your progress is saved locally in this browser.</p>
          <div className="space-y-3">
            {CHECKLIST_ITEMS.map(item => {
              const isChecked = !!checklist[item.id];
              return (
                <label key={item.id} className={`flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-colors border ${isChecked ? 'bg-brand-500/10 border-brand-500/30' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                  <div className={`w-6 h-6 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${isChecked ? 'bg-brand-500 border-brand-500' : 'border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-900'}`}>
                    {isChecked && <Shield className="w-4 h-4 text-slate-900 dark:text-white" />}
                  </div>
                  <span className={`text-sm font-medium transition-colors ${isChecked ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                    {item.label}
                  </span>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={isChecked}
                    onChange={() => toggleCheck(item.id)}
                  />
                </label>
              );
            })}
          </div>
          <button
            onClick={() => {
              setChecklist({});
              localStorage.removeItem('stream_security_checklist');
            }}
            className="mt-6 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-800"
          >
            Reset Checklist
          </button>
        </div>
      </div>
      </div>
    </>
  );
}
