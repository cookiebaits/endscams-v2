import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, AlertTriangle } from 'lucide-react';

export default function DisclaimerPage() {
  const navigate = useNavigate();

  const handleAccept = () => {
    localStorage.setItem('disclaimer_accepted', 'true');
    localStorage.setItem('disclaimer_accepted_date', new Date().toISOString());
    navigate('/home');
  };

  const handleDeny = () => {
    window.location.href = 'https://search.brave.com';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="card p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-brand-500/10 rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8 text-brand-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Disclaimer: Terms and Conditions</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Please read carefully before proceeding</p>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                By clicking "I Accept" below, you acknowledge that you have read, understood, and agree to be bound by all terms and conditions outlined in this disclaimer.
              </p>
            </div>
          </div>

          <div className="prose dark:prose-invert max-w-none space-y-6 text-sm mb-8 max-h-[500px] overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-lg p-6 bg-white dark:bg-gray-900">
            <section>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">1. Purpose and Educational Intent</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                The CyberScam Watch Dog Network ("The Network") & Ruinscams.com & Cookiebaits is an educational and documentary initiative dedicated to raising public awareness about fraud, cybercrime, and social engineering tactics.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                All content is created and shared strictly for informational, educational, and entertainment purposes. It does not constitute professional advice, investigative services, legal counsel, cybersecurity consulting, or any form of actionable guidance.
              </p>
              <p className="text-gray-700 dark:text-gray-300">You acknowledge that:</p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-1">
                <li>No fiduciary, advisory, or service-based relationship is formed by accessing or interacting with this content.</li>
                <li>The Network does not offer recovery services, law enforcement support, or technical protection tools.</li>
                <li>Views and opinions expressed are those of Cookiebaits and do not represent any government, law enforcement, or regulatory body.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">2. Mandatory Reporting & Emergency Protocols</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                The Network is not a law enforcement agency, emergency responder, or crime reporting platform.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-2">If you believe a crime has occurred:</p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-1">
                <li>In the U.S.: Report immediately to the FBI's IC3 or the FTC.</li>
                <li>Outside the U.S.: Contact your national cybercrime unit (e.g., Action Fraud (UK), Scamwatch (AU), local police).</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 mt-2">
                Cookiebaits assumes no responsibility for delays, failures, or consequences resulting from reliance on this content instead of official reporting channels.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">3. Comprehensive Limitation of Liability</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                To the fullest extent permitted by law, Cookiebaits and its affiliates disclaim all liability for any direct, indirect, incidental, or consequential damages arising from your access to or use of this content.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-2">This includes, but is not limited to:</p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-1">
                <li>Financial losses due to scams, phishing, or fraud</li>
                <li>Data breaches, malware infections, or system damage from attempted replication of scambaiting techniques</li>
                <li>Misinterpretation, misuse, or unauthorized application of information</li>
                <li>Outdated or evolving scam methodologies</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 mt-2">
                Content is provided "as is" and "as available" without warranties of any kind, express or implied.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">4. Assumption of Risk & Independent Responsibility</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-2">By engaging with this content, you expressly assume all risks associated with:</p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-1">
                <li>Attempting to interact with suspected scammers or fraudulent systems</li>
                <li>Conducting independent research or digital investigations</li>
                <li>Sharing personal or technical information online</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 mb-2 mt-3">You agree to:</p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-1">
                <li>Conduct your own due diligence (Do Your Own Research – DYOR)</li>
                <li>Consult licensed professionals (legal, financial, cybersecurity) before taking action</li>
                <li>Never impersonate law enforcement or engage in illegal activity</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 mt-2">
                Cookiebaits does not endorse, encourage, or support any form of retaliation, hacking, or unauthorized access.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">5. Jurisdiction, Governing Law & Dispute Resolution</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                These Terms are governed by the laws of the State of California and the United States.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                Any legal claims must be brought in state or federal courts located in Los Angeles County, California, and you waive the right to jury trial and agree to individual arbitration unless prohibited by law.
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                International users acknowledge that content is provided under U.S. legal standards and are responsible for compliance with local laws.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">6. Indemnification</h2>
              <p className="text-gray-700 dark:text-gray-300">
                You agree to indemnify, defend, and hold harmless Cyberscam Watchdog Network & Ruinscams.com & Cookiebaits, its officers, employees, and affiliates from any claims, damages, losses, liabilities, or expenses (including attorney's fees) arising from:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-1 mt-2">
                <li>Your use or misuse of content</li>
                <li>Violation of these Terms</li>
                <li>Breach of applicable laws or regulations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">7. Intellectual Property & Fair Use Notice</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                All original content (videos, scripts, graphics, commentary) is the exclusive property of Cookiebaits and protected under U.S. and international copyright laws.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                Unauthorized reproduction, redistribution, or monetization is strictly prohibited.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                Use of third-party content (e.g., scammer recordings, screenshots) is made under fair use principles (17 U.S.C. § 107) for purposes of criticism, commentary, news reporting, and education.
              </p>
              <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mt-3">
                <p className="text-sm italic text-gray-700 dark:text-gray-300">
                  Fair Use Disclaimer: "This content includes copyrighted material used under fair use for educational and critical commentary. No copyright infringement is intended. All rights belong to their respective owners."
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">8. No Endorsements or Affiliate Relationships</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                Cyberscam Watchdog Network & Ruinscams.com & Cookiebaits does not receive compensation for promoting tools, services, or organizations. Any mention is for informational purposes only and does not constitute endorsement.
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                If future affiliate relationships exist, they will be clearly disclosed in compliance with FTC guidelines.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">9. Content Moderation & User Conduct</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-2">You agree not to:</p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-1">
                <li>Post threats, harassment, or illegal content in comments</li>
                <li>Share personally identifiable information (PII) of others</li>
                <li>Use the platform to coordinate illegal scambaiting or harassment</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 mt-2">
                Cyberscam Watchdog Network & Ruinscams.com & Cookiebaits reserves the right to remove content, ban users, or report activity to authorities without notice.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">10. Updates & Acknowledgment</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                These Terms may be updated periodically. Continued use constitutes acceptance and possibly using out of date information.
              </p>
              <p className="text-gray-700 dark:text-gray-300 font-semibold">
                You affirm that you have read, understood, and agreed to all terms herein.
              </p>
            </section>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleDeny}
              className="flex-1 px-6 py-3 border-2 border-gray-300 dark:border-gray-700 rounded-xl font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              I Do Not Accept
            </button>
            <button
              onClick={handleAccept}
              className="flex-1 btn-primary px-6 py-3 rounded-xl font-semibold"
            >
              I Accept
            </button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-500 text-center mt-4">
            By clicking "I Accept", you will be redirected to the main site. Clicking "I Do Not Accept" will redirect you to Brave Search.
          </p>
        </div>
      </div>
    </div>
  );
}
