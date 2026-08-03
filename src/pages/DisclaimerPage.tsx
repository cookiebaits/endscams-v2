/* eslint-disable no-irregular-whitespace */

import { useNavigate } from "react-router-dom";
import { Shield, AlertTriangle } from "lucide-react";

export default function DisclaimerPage() {
  const navigate = useNavigate();

  const handleAccept = () => {
    localStorage.setItem("disclaimer_accepted", "true");
    localStorage.setItem("disclaimer_accepted_date", new Date().toISOString());
    navigate("/home");
  };

  const handleDeny = () => {
    // user does not accept – send them to Brave Search
    window.location.href = "https://search.brave.com";
  };

  /* -------------------------------------------------
   *  Full “Terms of Use” + “Privacy Policy” content.
   *  This string is inserted into a pre‑formatted block
   *  so the original line‑breaks and numbering are retained.
   * ------------------------------------------------- */
  const termsAndPrivacy = `Website Terms of Use
Version 1.0
Last revised on: 04-20, 2026

The website located at endscams.org (the “Site”) is a copyrighted work belonging to Cyberscam Watchdog Network, a California nonprofit organization (“Company”, “us”, “our”, and “we”). Certain features of the Site may be subject to additional guidelines, terms, or rules, which will be posted on the Site in connection with such features. All such additional terms, guidelines, and rules are incorporated by reference into these Terms.

These Terms of Use (these “Terms”) set forth the legally binding terms and conditions that govern your use of the Site. By accessing or using the Site, you are accepting these Terms (on behalf of yourself or the entity that you represent), and you represent and warrant that you have the right, authority, and capacity to enter into these Terms (on behalf of yourself or the entity that you represent). you may not access or use the Site or accept the Terms if you are not at least 18 years old. If you do not agree with all of the provisions of these Terms, do not access and/or use the Site.

PLEASE BE AWARE THAT SECTION 10.2 CONTAINS PROVISIONS GOVERNING HOW TO RESOLVE DISPUTES BETWEEN YOU AND COMPANY. AMONG OTHER THINGS, SECTION 10.2 INCLUDES AN AGREEMENT TO ARBITRATE, WHICH REQUIRES, WITH LIMITED EXCEPTIONS, THAT ALL DISPUTES BETWEEN YOU AND US SHALL BE RESOLVED BY BINDING AND FINAL ARBITRATION. SECTION 10.2 ALSO CONTAINS A CLASS ACTION AND JURY TRIAL WAIVER. PLEASE READ SECTION 10.2 CAREFULLY.
UNLESS YOU OPT OUT OF THE AGREEMENT TO ARBITRATE WITHIN 30 DAYS: (1) YOU WILL ONLY BE PERMITTED TO PURSUE DISPUTES OR CLAIMS AND SEEK RELIEF AGAINST US ON AN INDIVIDUAL BASIS, NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY CLASS OR REPRESENTATIVE ACTION OR PROCEEDING AND YOU WAIVE YOUR RIGHT TO PARTICIPATE IN A CLASS ACTION LAWSUIT OR CLASS-WIDE ARBITRATION; AND (2) YOU ARE WAIVING YOUR RIGHT TO PURSUE DISPUTES OR CLAIMS AND SEEK RELIEF IN A COURT OF LAW AND TO HAVE A JURY TRIAL.

1. Accounts
1.1 Account Creation.  In order to use certain features of the Site, including subscribing to newsletters, registering for presentations and events, and making donations, you may be required to register for an account (“Account”) and provide certain information about yourself as prompted by the registration form, which may include your name, email address, and phone number. You represent and warrant that: (a) all required registration information you submit is truthful and accurate; (b) you will maintain the accuracy of such information; and (c) you are at least 18 years of age. Company does not independently verify the age of its users; by creating an Account or otherwise using the Site, you represent that you meet the minimum age requirements set forth in these Terms. You may delete your Account at any time, for any reason, by following the instructions on the Site or by contacting Company using the information provided in Section 10.8. Company may suspend or terminate your Account in accordance with Section 10.
1.2 Account Responsibilities.  You are responsible for maintaining the confidentiality of your Account login information and are fully responsible for all activities that occur under your Account. You agree to immediately notify Company of any unauthorized use, or suspected unauthorized use of your Account or any other breach of security. Company cannot and will not be liable for any loss or damage arising from your failure to comply with the above requirements.

2. Access to the Site
2.1 License.  Subject to these Terms, Company grants you a non‑transferable, non‑exclusive, revocable, limited license to use and access the Site solely for your personal, non‑commercial, educational, and informational purposes. You may use the Site to access educational content related to scam prevention and avoidance, utilize the scam identification and tracking tools, register for presentations and events, subscribe to newsletters, download educational materials, upload images of suspected scams, and make tax‑deductible donations to the Company, in each case subject to the terms and conditions set forth herein.
2.2 Certain Restrictions.  The rights granted to you in these Terms are subject to the following restrictions: (a) you shall not license, sell, rent, lease, transfer, assign, distribute, host, or otherwise commercially exploit the Site, whether in whole or in part, or any content displayed on the Site; (b) you shall not modify, make derivative works of, disassemble, reverse compile or reverse engineer any part of the Site; (c) you shall not access the Site in order to build a similar or competitive website, product, or service; and (d) except as expressly stated herein, no part of the Site may be copied, reproduced, distributed, republished, downloaded, displayed, posted or transmitted in any form or by any means. Unless otherwise indicated, any future release, update, or other addition to functionality of the Site shall be subject to these Terms. All copyright and other proprietary notices on the Site (or on any content displayed on the Site) must be retained on all copies thereof.
2.3 Modification.  Company reserves the right, at any time, to modify, suspend, or discontinue the Site (in whole or in part) with or without notice to you. You agree that Company will not be liable to you or to any third party for any modification, suspension, or discontinuation of the Site or any part thereof.
2.4 No Support or Maintenance.  You acknowledge and agree that Company will have no obligation to provide you with any support or maintenance in connection with the Site.
2.5 Ownership.  You acknowledge that all the intellectual property rights, including copyrights, patents, trademarks, and trade secrets, in the Site and its content, including software, articles, photographs, images, videos, educational materials, presentations, downloadable documents, reports, newsletters, and all other content created or provided by Company, are owned by Company or Company’s suppliers. All photographs, images, and videos used by Company as educational materials on the Site are the exclusive intellectual property of Company and are protected by applicable copyright and intellectual property laws. Neither these Terms (nor your access to the Site) transfers to you or any third party any rights, title or interest in or to such intellectual property rights, except for the limited access rights expressly set forth in Section 2.1. Company and its suppliers reserve all rights not granted in these Terms. There are no implied licenses granted under these Terms.
2.6 Feedback.  If you provide Company with any feedback or suggestions regarding the Site (“Feedback”), you hereby assign to Company all rights in such Feedback and agree that Company shall have the right to use and fully exploit such Feedback and related information in any manner it deems appropriate. Company will treat any Feedback you provide to Company as non‑confidential and non‑proprietary. You agree that you will not submit to Company any information or ideas that you consider to be confidential or proprietary.
2.7 User Contributed Content. When you upload photographs, screenshots, or other content to our website (for example, images of potential scams) (“User Contributed Content”), you grant Cyberscam a non‑exclusive, royalty‑free, perpetual license to use, display, reproduce, and distribute that content for educational and informational purposes in connection with our mission. You represent and warrant that you have the right to submit such content and that it does not infringe the rights of any third party.

3. Services
3.1 General.  The Company provides information and services in line with its charitable purpose to end scamming through education. The Site provides educational resources and tools designed to help individuals, particularly senior citizens and other vulnerable populations, identify, report, and avoid scams and fraudulent activities. The following services are available through the Site, subject to these Terms.
3.2 Scam Phone Number Search.  The Site offers a search tool that allows you to enter a phone number suspected of being associated with a scam. The search utilizes third‑party search engines, including Google, Brave, and Bing, to query publicly available information about the phone number. Results may indicate that a number is “Very Likely a Scam,” “Somewhat Likely a Scam,” or “Not Likely a Scam.” These results are provided as a guide only and do not constitute a guarantee, certification, or definitive determination that any phone number is or is not associated with fraudulent activity. You acknowledge and agree that Company shall not be liable for any reliance you place on the results of the scam phone number search tool.
3.3 Scam Tracker.  The Site incorporates a scam tracking tool powered by the Better Business Bureau (“BBB”) database. You may search a phone number or other potential scammer source to determine whether others have reported fraudulent activity associated with that source. The scam tracker may display phone numbers in up to three different formats. Results are provided by the BBB and Company makes no representations or warranties as to the accuracy, completeness, or reliability of such results.
3.4 Local Law Enforcement Referral.  The Site features a banner directing you to contact your local sheriff’s non‑emergency line if you believe you have been targeted by a scam. Upon clicking the banner, you will be redirected to a third‑party search engine results page that may display your local sheriff’s office based on your browser’s location settings and preferences. The Site does not access, collect, or store your geographic location data. If you have location services enabled in your browser, the search engine may return localized results; if location services are disabled, the search engine will return general results. Company does not control and is not responsible for the content or accuracy of search engine results.
3.5 Newsletters and Communications.  You may voluntarily provide your name, email address, and, optionally, your phone number to subscribe to Company’s newsletters. Newsletters may contain educational content regarding new scam tactics, avoidance strategies, and other information related to Company’s mission. You may unsubscribe from newsletters at any time by following the unsubscribe instructions included in each newsletter or by contacting Company using the information provided in Section 10.8.
3.6 Presentations and Events.  The Company conducts in‑person and virtual presentations and events focused on scam prevention education, which may be held at public venues including, but not limited to, libraries and community centers. You may register for such events by providing your name, email address, and other requested registration information. Company may host virtual presentations and meetings using its proprietary video conferencing platform. By registering for or attending a Company presentation or event, you agree to abide by any applicable codes of conduct or rules communicated by Company.
3.7 Educational Materials.  You may download files, documents, and other educational materials made available on the Site for your personal, non‑commercial use. All educational materials are subject to the intellectual property protections described in Section 2.5 of these Terms. You may not reproduce, distribute, modify, or create derivative works of any educational materials without Company’s prior written consent.
3.8 User Uploads.  You may upload photographs, images, or other content depicting suspected scams to the Site (“User Content”). You are solely responsible for any User Content you upload and the consequences of posting or sharing it. By uploading User Content to the Site, you grant Company a non‑exclusive, royalty‑free, perpetual, irrevocable, worldwide license to use, copy, modify, display, distribute, and create derivative works from your User Content for educational, informational, and nonprofit purposes, including in presentations, newsletters, and other materials published by Company. You represent and warrant that: (a) you own or have the necessary rights to use and authorize Company to use your User Content as described herein; (b) your User Content does not violate the privacy rights, publicity rights, intellectual property rights, or other rights of any third party; and (c) your User Content does not contain any material that is unlawful, defamatory, obscene, or otherwise objectionable.

4. Donations and Payments
4.1 Making Donations.  The Site may permit you to make one‑time or recurring donations to Company. All donation transactions are processed through third‑party payment processors. By submitting payment information, you authorize Company and its designated third‑party payment processors to charge your selected payment method for any donations you make, including, if applicable, on a recurring basis until you cancel.
4.2 Payment Information.  For users who elect to make recurring donations, Company or its third‑party payment processors may store your credit card or other payment information as necessary to process future recurring donations. Company and its third‑party payment processors implement industry‑standard security measures, including encryption and compliance with the Payment Card Industry Data Security Standard (“PCI DSS”), to protect stored payment information. You may cancel recurring donations or request deletion of stored payment information at any time by contacting Company using the information provided in Section 10.8.
4.3 Refund Policy.  All donations are voluntary, tax‑deductible, and are generally non‑refundable unless otherwise required by applicable law. If you believe a donation was processed in error, please contact Company using the information provided in Section 10.8.

5. Indemnification.  You agree to indemnify and hold Company (and its officers, employees, and agents) harmless, including costs and attorneys’ fees, from any claim or demand made by any third party due to or arising out of (a) your use of the Site, (b) your violation of these Terms or (c) your violation of applicable laws or regulations. Company reserves the right, at your expense, to assume the exclusive defense and control of any matter for which you are required to indemnify us, and you agree to cooperate with our defense of these claims. You agree not to settle any matter without the prior written consent of Company. Company will use reasonable efforts to notify you of any such claim, action or proceeding upon becoming aware of it.

6. Third‑Party Links & Ads; Other Users
6.1 Third‑Party Links & Ads.  The Site may contain links to third‑party websites and services, and/or display content from third parties (collectively, “Third‑Party Links & Ads”), including integrations with Google, Brave, and Bing search engines, the Better Business Bureau scam tracker database, and links to local law enforcement websites. Such Third‑Party Links & Ads are not under the control of Company, and Company is not responsible for any Third‑Party Links & Ads. Company provides access to these Third‑Party Links & Ads only as a convenience to you, and does not review, approve, monitor, endorse, warrant, or make any representations with respect to Third‑Party Links & Ads. You use all Third‑Party Links & Ads at your own risk, and should apply a suitable level of caution and discretion in doing so. When you click on any of the Third‑Party Links & Ads, the applicable third party’s terms and policies apply, including the third party’s privacy and data gathering practices. You should make whatever investigation you feel necessary or appropriate before proceeding with any transaction in connection with such Third‑Party Links & Ads.
6.2 Other Users.  Your interactions with other Site users are solely between you and such users. You agree that Company will not be responsible for any loss or damage incurred as the result of any such interactions. If there is a dispute between you and any Site user, we are under no obligation to become involved.
6.3 Release.  You hereby release and forever discharge Company (and our officers, employees, agents, successors, and assigns) from, and hereby waive and relinquish, each and every past, present and future dispute, claim, controversy, demand, right, obligation, liability, action and cause of action of every kind and nature (including personal injuries, death, and property damage), that has arisen or arises directly or indirectly out of, or that relates directly or indirectly to, the Site (including any interactions with, or act or omission of, other Site users or any Third‑Party Links & Ads). IF YOU ARE A CALIFORNIA RESIDENT, YOU HEREBY WAIVE CALIFORNIA CIVIL CODE SECTION 1542 IN CONNECTION WITH THE FOREGOING, WHICH STATES: “A GENERAL RELEASE DOES NOT EXTEND TO CLAIMS WHICH THE CREDITOR OR RELEASING PARTY DOES NOT KNOW OR SUSPECT TO EXIST IN HIS OR HER FAVOR AT THE TIME OF EXECUTING THE RELEASE, WHICH IF KNOWN BY HIM OR HER MUST HAVE MATERIALLY AFFECTED HIS OR HER SETTLEMENT WITH THE DEBTOR OR RELEASED PARTY.”

7. Disclaimers
THE SITE IS PROVIDED ON AN “AS‑IS” AND “AS AVAILABLE” BASIS, AND COMPANY (AND OUR SUPPLIERS) EXPRESSLY DISCLAIM ANY AND ALL WARRANTIES AND CONDITIONS OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING ALL WARRANTIES OR CONDITIONS OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, QUIET ENJOYMENT, ACCURACY, OR NON‑INFRINGEMENT. WE (AND OUR SUPPLIERS) MAKE NO WARRANTY THAT THE SITE WILL MEET YOUR REQUIREMENTS, WILL BE AVAILABLE ON AN UNINTERRUPTED, TIMELY, SECURE, OR ERROR‑FREE BASIS, OR WILL BE ACCURATE, RELIABLE, FREE OF VIRUSES OR OTHER HARMFUL CODE, COMPLETE, LEGAL, OR SAFE. IF APPLICABLE LAW REQUIRES ANY WARRANTIES WITH RESPECT TO THE SITE, ALL SUCH WARRANTIES ARE LIMITED IN DURATION TO 90 DAYS FROM THE DATE OF FIRST USE.

WITHOUT LIMITING THE FOREGOING, COMPANY MAKES NO WARRANTY OR REPRESENTATION THAT THE SCAM PHONE NUMBER SEARCH TOOL, SCAM TRACKER, OR ANY OTHER TOOL OR FEATURE ON THE SITE WILL ACCURATELY IDENTIFY WHETHER ANY PHONE NUMBER, INDIVIDUAL, OR ENTITY IS ASSOCIATED WITH FRAUDULENT ACTIVITY. THE RESULTS PROVIDED BY SUCH TOOLS ARE FOR INFORMATIONAL AND EDUCATIONAL PURPOSES ONLY AND SHOULD NOT BE RELIED UPON AS A DEFINITIVE DETERMINATION OF WHETHER A SCAM HAS OCCURRED OR IS OCCURRING. COMPANY STRONGLY ENCOURAGES YOU TO REPORT ALL SUSPECTED SCAMS TO YOUR LOCAL LAW ENFORCEMENT AUTHORITIES.

SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OF IMPLIED WARRANTIES, SO THE ABOVE EXCLUSION MAY NOT APPLY TO YOU. SOME JURISDICTIONS DO NOT ALLOW LIMITATIONS ON HOW LONG AN IMPLIED WARRANTY LASTS, SO THE ABOVE LIMITATION MAY NOT APPLY TO YOU.

8. Limitation on Liability
TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL COMPANY (OR OUR SUPPLIERS) BE LIABLE TO YOU OR ANY THIRD PARTY FOR ANY LOST PROFITS, LOST DATA, COSTS OF PROCUREMENT OF SUBSTITUTE PRODUCTS, OR ANY INDIRECT, CONSEQUENTIAL, EXEMPLARY, INCIDENTAL, SPECIAL OR PUNITIVE DAMAGES ARISING FROM OR RELATING TO THESE TERMS OR YOUR USE OF, OR INABILITY TO USE, THE SITE, EVEN IF COMPANY HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. ACCESS TO, AND USE OF, THE SITE IS AT YOUR OWN DISCRETION AND RISK, AND YOU WILL BE SOLELY RESPONSIBLE FOR ANY DAMAGE TO YOUR DEVICE OR COMPUTER SYSTEM, OR LOSS OF DATA RESULTING THEREFROM.

TO THE MAXIMUM EXTENT PERMITTED BY LAW, NOTWITHSTANDING ANYTHING TO THE CONTRARY CONTAINED HEREIN, OUR LIABILITY TO YOU FOR ANY DAMAGES ARISING FROM OR RELATED TO THESE TERMS (FOR ANY CAUSE WHATSOEVER AND REGARDLESS OF THE FORM OF THE ACTION), WILL AT ALL TIMES BE LIMITED TO A MAXIMUM OF FIFTY US DOLLARS. THE EXISTENCE OF MORE THAN ONE CLAIM WILL NOT ENLARGE THIS LIMIT. YOU AGREE THAT OUR SUPPLIERS WILL HAVE NO LIABILITY OF ANY KIND ARISING FROM OR RELATING TO THESE TERMS.

SOME JURISDICTIONS DO NOT ALLOW THE LIMITATION OR EXCLUSION OF LIABILITY FOR INCIDENTAL OR CONSEQUENTIAL DAMAGES, SO THE ABOVE LIMITATION OR EXCLUSION MAY NOT APPLY TO YOU.

9. Term and Termination.  Subject to this Section, these Terms will remain in full force and effect while you use the Site. We may suspend or terminate your rights to use the Site (including your Account) at any time for any reason at our sole discretion, including for any use of the Site in violation of these Terms. Upon termination of your rights under these Terms, your Account and right to access and use the Site will terminate immediately.  Company will not have any liability whatsoever to you for any termination of your rights under these Terms, including for termination of your Account. Even after your rights under these Terms are terminated, the following provisions of these Terms will remain in effect: Sections 2.2 through 2.7 and Sections 3 through 10.

10. General
10.1 Changes.  These Terms are subject to occasional revision, and if we make any substantial changes, we may notify you by sending you an e‑mail to the last e‑mail address you provided to us (if any), and/or by prominently posting notice of the changes on our Site. You are responsible for providing us with your most current e‑mail address. In the event that the last e‑mail address that you provided us is not valid, or for any reason is not capable of delivering to you the notice described above, our dispatch of the e‑mail containing such notice will nonetheless constitute effective notice of the changes described in the notice. Continued use of our Site following notice of such changes shall indicate your acknowledgement of such changes and agreement to be bound by the terms and conditions of such changes.
10.2 Dispute Resolution.  Please read the following arbitration agreement in this Section (the “Arbitration Agreement”) carefully. It requires you to arbitrate disputes with Company, its parent companies, subsidiaries, affiliates, successors and assigns and all of their respective officers, directors, employees, agents, and representatives (collectively, the “Company Parties”) and limits the manner in which you can seek relief from the Company Parties.
(a) Applicability of Arbitration Agreement.  You agree that any dispute between you and any of the Company Parties relating in any way to the Site, the services offered on the Site (the “Services”) or these Terms will be resolved by binding arbitration, rather than in court, except that (1) you and the Company Parties may assert individualized claims in small claims court if the claims qualify, remain in such court and advance solely on an individual, non‑class basis; and (2) you or the Company Parties may seek equitable relief in court for infringement or other misuse of intellectual property rights (such as trademarks, trade dress, domain names, trade secrets, copyrights, and patents). This Arbitration Agreement shall survive the expiration or termination of these Terms and shall apply, without limitation, to all claims that arose or were asserted before you agreed to these Terms (in accordance with the preamble) or any prior version of these Terms. This Arbitration Agreement does not preclude you from bringing issues to the attention of federal, state or local agencies. Such agencies can, if the law allows, seek relief against the Company Parties on your behalf. For purposes of this Arbitration Agreement, “Dispute” will also include disputes that arose or involve facts occurring before the existence of this or any prior versions of the Agreement as well as claims that may arise after the termination of these Terms.
(b) Informal Dispute Resolution.  There might be instances when a Dispute arises between you and Company. If that occurs, Company is committed to working with you to reach a reasonable resolution. You and Company agree that good faith informal efforts to resolve Disputes can result in a prompt, low‑cost and mutually beneficial outcome. You and Company therefore agree that before either party commences arbitration against the other (or initiates an action in small claims court if a party so elects), we will personally meet and confer telephonically or via videoconference, in a good faith effort to resolve informally any Dispute covered by this Arbitration Agreement (“Informal Dispute Resolution Conference”). If you are represented by counsel, your counsel may participate in the conference, but you will also participate in the conference.
The party initiating a Dispute must give notice to the other party in writing of its intent to initiate an Informal Dispute Resolution Conference (“Notice”), which shall occur within 45 days after the other party receives such Notice, unless an extension is mutually agreed upon by the parties. Notice to Company that you intend to initiate an Informal Dispute Resolution Conference should be sent by email to: ________________, or by regular mail to 524 W Garvey Ave. Monterey Park, CA 91754 United States. The Notice must include: (1) your name, telephone number, mailing address, e‑mail address associated with your account (if you have one); (2) the name, telephone number, mailing address and e‑mail address of your counsel, if any; and (3) a description of your Dispute.
The Informal Dispute Resolution Conference shall be individualized such that a separate conference must be held each time either party initiates a Dispute, even if the same law firm or group of law firms represents multiple users in similar cases, unless all parties agree; multiple individuals initiating a Dispute cannot participate in the same Informal Dispute Resolution Conference unless all parties agree. In the time between a party receiving the Notice and the Informal Dispute Resolution Conference, nothing in this Arbitration Agreement shall prohibit the parties from engaging in informal communications to resolve the initiating party’s Dispute. Engaging in the Informal Dispute Resolution Conference is a condition precedent and requirement that must be fulfilled before commencing arbitration. The statute of limitations and any filing fee deadlines shall be tolled while the parties engage in the Informal Dispute Resolution Conference process required by this section.
(c) Arbitration Rules and Forum. These Terms evidence a transaction involving interstate commerce; and notwithstanding any other provision herein with respect to the applicable substantive law, the Federal Arbitration Act, 9 U.S.C. § 1 et seq., will govern the interpretation and enforcement of this Arbitration Agreement and any arbitration proceedings. If the Informal Dispute Resolution Process described above does not resolve satisfactorily within 60 days after receipt of your Notice, you and Company agree that either party shall have the right to finally resolve the Dispute through binding arbitration. The Federal Arbitration Act governs the interpretation and enforcement of this Arbitration Agreement. The arbitration will be conducted by JAMS, an established alternative dispute resolution provider. Disputes involving claims and counterclaims with an amount in controversy under $250,000, not inclusive of attorneys’ fees and interest, shall be subject to JAMS’ most current version of the Streamlined Arbitration Rules and procedures available at http://www.jamsadr.com/rules-streamlined-arbitration/; all other claims shall be subject to JAMS’s most current version of the Comprehensive Arbitration Rules and Procedures, available at http://www.jamsadr.com/rules-comprehensive-arbitration/. JAMS’s rules are also available at www.jamsadr.com or by calling JAMS at 800‑352‑5267. A party who wishes to initiate arbitration must provide the other party with a request for arbitration (the “Request”). The Request must include: (1) the name, telephone number, mailing address, e‑mail address of the party seeking arbitration and the account username (if applicable) as well as the email address associated with any applicable account; (2) a statement of the legal claims being asserted and the factual bases of those claims; (3) a description of the remedy sought and an accurate, good‑faith calculation of the amount in controversy in United States Dollars; (4) a statement certifying completion of the Informal Dispute Resolution process as described above; and (5) evidence that the requesting party has paid any necessary filing fees in connection with such arbitration.
If the party requesting arbitration is represented by counsel, the Request shall also include counsel’s name, telephone number, mailing address, and email address. Such counsel must also sign the Request. By signing the Request, counsel certifies to the best of counsel’s knowledge, information, and belief, formed after an inquiry reasonable under the circumstances, that: (1) the Request is not being presented for any improper purpose, such as to harass, cause unnecessary delay, or needlessly increase the cost of dispute resolution; (2) the claims, defenses and other legal contentions are warranted by existing law or by a non‑frivolous argument for extending, modifying, or reversing existing law or for establishing new law; and (3) the factual and damages contentions have evidentiary support or, if specifically so identified, will likely have evidentiary support after a reasonable opportunity for further investigation or discovery.
Unless you and Company otherwise agree, or the Batch Arbitration process discussed in Subsection 10.2(h) is triggered, the arbitration will be conducted in the county where you reside. Subject to the JAMS Rules, the arbitrator may direct a limited and reasonable exchange of information between the parties, consistent with the expedited nature of the arbitration. If JAMS is not available to arbitrate, the parties will select an alternative arbitral forum. Your responsibility to pay any JAMS fees and costs will be solely as set forth in the applicable JAMS Rules.
You and Company agree that all materials and documents exchanged during the arbitration proceedings shall be kept confidential and shall not be shared with anyone except the parties’ attorneys, accountants, or business advisors, and then subject to the condition that they agree to keep all materials and documents exchanged during the arbitration proceedings confidential.
(d) Authority of Arbitrator.  The arbitrator shall have exclusive authority to resolve all disputes subject to arbitration hereunder including, without limitation, any dispute related to the interpretation, applicability, enforceability or formation of this Arbitration Agreement or any portion of the Arbitration Agreement, except for the following: (1) all Disputes arising out of or relating to the subsection entitled “Waiver of Class or Other Non‑Individualized Relief,” including any claim that all or part of the subsection entitled “Waiver of Class or Other Non‑Individualized Relief” is unenforceable, illegal, void or voidable, or that such subsection entitled “Waiver of Class or Other Non‑Individualized Relief” has been breached, shall be decided by a court of competent jurisdiction and not by an arbitrator; (2) except as expressly contemplated in the subsection entitled “Batch Arbitration,” all Disputes about the payment of arbitration fees shall be decided only by a court of competent jurisdiction and not by an arbitrator; (3) all Disputes about whether either party has satisfied any condition precedent to arbitration shall be decided only by a court of competent jurisdiction and not by an arbitrator; and (4) all Disputes about which version of the Arbitration Agreement applies shall be decided only by a court of competent jurisdiction and not by an arbitrator. The arbitration proceeding will not be consolidated with any other matters or joined with any other cases or parties, except as expressly provided in the subsection entitled “Batch Arbitration.” The arbitrator shall have the authority to grant motions dispositive of all or part of any claim or dispute. The arbitrator shall have the authority to award monetary damages and to grant any non‑monetary remedy or relief available to an individual party under applicable law, the arbitral forum’s rules, and these Terms (including the Arbitration Agreement). The arbitrator shall issue a written award and statement of decision describing the essential findings and conclusions on which any award (or decision not to render an award) is based, including the calculation of any damages awarded. The arbitrator shall follow the applicable law. The award of the arbitrator is final and binding upon you and us. Judgment on the arbitration award may be entered in any court having jurisdiction.
(e) Waiver of Jury Trial. EXCEPT AS SPECIFIED in section 10.2(a) YOU AND THE COMPANY PARTIES HEREBY WAIVE ANY CONSTITUTIONAL AND STATUTORY RIGHTS TO SUE IN COURT AND HAVE A TRIAL IN FRONT OF A JUDGE OR A JURY. You and the Company Parties are instead electing that all covered claims and disputes shall be resolved exclusively by arbitration under this Arbitration Agreement, except as specified in Section 10.2(a) above. An arbitrator can award on an individual basis the same damages and relief as a court and must follow these Terms as a court would. However, there is no judge or jury in arbitration, and court review of an arbitration award is subject to very limited review.
(f) Waiver of Class or Other Non‑Individualized Relief. YOU AND COMPANY AGREE THAT, EXCEPT AS SPECIFIED IN SUBSECTION 10.2(h) EACH OF US MAY BRING CLAIMS AGAINST THE OTHER ONLY ON AN INDIVIDUAL BASIS AND NOT ON A CLASS, REPRESENTATIVE, OR COLLECTIVE BASIS, AND THE PARTIES HEREBY WAIVE ALL RIGHTS TO HAVE ANY DISPUTE BE BROUGHT, HEARD, ADMINISTERED, RESOLVED, OR ARBITRATED ON A CLASS, COLLECTIVE, REPRESENTATIVE, OR MASS ACTION BASIS. ONLY INDIVIDUAL RELIEF IS AVAILABLE, AND DISPUTES OF MORE THAN ONE CUSTOMER OR USER CANNOT BE ARBITRATED OR CONSOLIDATED WITH THOSE OF ANY OTHER CUSTOMER OR USER. Subject to this Arbitration Agreement, the arbitrator may award declaratory or injunctive relief only in favor of the individual party seeking relief and only to the extent necessary to provide relief warranted by the party’s individual claim. Nothing in this paragraph is intended to, nor shall it, affect the terms and conditions under the Subsection 10.2(h) entitled “Batch Arbitration.” Notwithstanding anything to the contrary in this Arbitration Agreement, if a court decides by means of a final decision, not subject to any further appeal or recourse, that the limitations of this subsection, “Waiver of Class or Other Non‑Individualized Relief,” are invalid or unenforceable as to a particular claim or request for relief (such as a request for public injunctive relief), you and Company agree that that particular claim or request for relief (and only that particular claim or request for relief) shall be severed from the arbitration and may be litigated in the state or federal courts located in the State of California. All other Disputes shall be arbitrated or litigated in small claims court. This subsection does not prevent you or Company from participating in a class‑wide settlement of claims.
(g) Attorneys’ Fees and Costs.  The parties shall bear their own attorneys’ fees and costs in arbitration unless the arbitrator finds that either the substance of the Dispute or the relief sought in the Request was frivolous or was brought for an improper purpose (as measured by the standards set forth in Federal Rule of Civil Procedure 11(b)). If you or Company need to invoke the authority of a court of competent jurisdiction to compel arbitration, then the party that obtains an order compelling arbitration in such action shall have the right to collect from the other party its reasonable costs, necessary disbursements, and reasonable attorneys’ fees incurred in securing an order compelling arbitration. The prevailing party in any court action relating to whether either party has satisfied any condition precedent to arbitration, including the Informal Dispute Resolution Process, is entitled to recover their reasonable costs, necessary disbursements, and reasonable attorneys’ fees and costs.
(h) Batch Arbitration.  To increase the efficiency of administration and resolution of arbitrations, you and Company agree that in the event that there are 100 or more individual Requests of a substantially similar nature filed against Company by or with the assistance of the same law firm, group of law firms, or organizations, within a 30‑day period (or as soon as possible thereafter), the JAMS shall (1) administer the arbitration demands in batches of 100 Requests per batch (plus, to the extent there are less than 100 Requests left over after the batching described above, a final batch consisting of the remaining Requests); (2) appoint one arbitrator for each batch; and (3) provide for the resolution of each batch as a single consolidated arbitration with one set of filing and administrative fees due per side per batch, one procedural calendar, one hearing (if any) in a place to be determined by the arbitrator, and one final award (“Batch Arbitration”).
All parties agree that Requests are of a “substantially similar nature” if they arise out of or relate to the same event or factual scenario and raise the same or similar legal issues and seek the same or similar relief. To the extent the parties disagree on the application of the Batch Arbitration process, the disagreeing party shall advise the JAMS, and the JAMS shall appoint a sole standing arbitrator to determine the applicability of the Batch Arbitration process (“Administrative Arbitrator”). In an effort to expedite resolution of any such dispute by the Administrative Arbitrator, the parties agree that the Administrative Arbitrator may set forth such procedures as are necessary to resolve any disputes promptly. The Administrative Arbitrator’s fees shall be paid by Company.
You and Company agree to cooperate in good faith with the JAMS to implement the Batch Arbitration process including the payment of single filing and administrative fees for batches of Requests, as well as any steps to minimize the time and costs of arbitration, which may include: (1) the appointment of a discovery special master to assist the arbitrator in the resolution of discovery disputes; and (2) the adoption of an expedited calendar of the arbitration proceedings.
This Batch Arbitration provision shall in no way be interpreted as authorizing a class, collective and/or mass arbitration or action of any kind, or arbitration involving joint or consolidated claims under any circumstances, except as expressly set forth in this provision.
(i) 30‑Day Right to Opt Out. You have the right to opt out of the provisions of this Arbitration Agreement by sending a timely written notice of your decision to opt out to the following address: 524 W Garvey Ave, Monterey Park, CA 91754 ________________, or email to report@endscams.org, within 30 days after first becoming subject to this Arbitration Agreement. Your notice must include your name and address and a clear statement that you want to opt out of this Arbitration Agreement. If you opt out of this Arbitration Agreement, all other parts of these Terms will continue to apply to you. Opting out of this Arbitration Agreement has no effect on any other arbitration agreements that you may currently have with us or may enter into in the future with us.
(j) Invalidity, Expiration.  Except as provided in the subsection entitled “Waiver of Class or Other Non‑Individualized Relief”, if any part or parts of this Arbitration Agreement are found under the law to be invalid or unenforceable, then such specific part or parts shall be of no force and effect and shall be severed, and the remainder of the Arbitration Agreement shall continue in full force and effect. You further agree that any Dispute that you have with Company as detailed in this Arbitration Agreement must be initiated via arbitration within the applicable statute of limitation for that claim or controversy, or it will be forever time‑barred. Likewise, you agree that all applicable statutes of limitation will apply to such arbitration in the same manner as those statutes of limitation would apply in the applicable court of competent jurisdiction.
(k) Modification. Notwithstanding any provision in these Terms to the contrary, we agree that if Company makes any future material change to this Arbitration Agreement, you may reject that change within 30 days of such change becoming effective by writing Company at the following address: 524 W Garvey Ave, Monterey Park, CA 91754, or by email to: report@endscams.org. Unless you reject the change within 30 days of such change becoming effective by writing to Company in accordance with the foregoing, your continued use of the Site and/or Services, including the acceptance of products and services offered on the Site following the posting of changes to this Arbitration Agreement constitutes your acceptance of any such changes. Changes to this Arbitration Agreement do not provide you with a new opportunity to opt out of the Arbitration Agreement if you have previously agreed to a version of these Terms and did not validly opt out of arbitration. If you reject any change or update to this Arbitration Agreement, and you were bound by an existing agreement to arbitrate Disputes arising out of or relating in any way to your access to or use of the Services or of the Site, any communications you receive, any products sold or distributed through the Site, the Services, or these Terms, the provisions of this Arbitration Agreement as of the date you first accepted these Terms (or accepted any subsequent changes to these Terms) remain in full force and effect. Company will continue to honor any valid opt outs of the Arbitration Agreement that you made to a prior version of these Terms.
10.3 Export.  The Site may be subject to U.S. export control laws and may be subject to export or import regulations in other countries. You agree not to export, re‑export, or transfer, directly or indirectly, any U.S. technical data acquired from Company, or any products utilizing such data, in violation of the United States export laws or regulations.
10.4 Disclosures.  Company is located at the address in Section 10.8. If you are a California resident, you may report complaints to the Complaint Assistance Unit of the Division of Consumer Product of the California Department of Consumer Affairs by contacting them in writing at 400 R Street, Sacramento, CA 95814, or by telephone at (800) 952‑5210.
10.5 Electronic Communications.  The communications between you and Company use electronic means, whether you use the Site or send us emails, or whether Company posts notices on the Site or communicates with you via email. For contractual purposes, you (a) consent to receive communications from Company in an electronic form; and (b) agree that all terms and conditions, agreements, notices, disclosures, and other communications that Company provides to you electronically satisfy any legal requirement that such communications would satisfy if it were to be in a hard‑copy writing. The foregoing does not affect your non‑waivable rights.
10.6 Entire Terms.  These Terms constitute the entire agreement between you and us regarding the use of the Site. Our failure to exercise or enforce any right or provision of these Terms shall not operate as a waiver of such right or provision. The section titles in these Terms are for convenience only and have no legal or contractual effect. The word “including” means “including without limitation”. If any provision of these Terms is, for any reason, held to be invalid or unenforceable, the other provisions of these Terms will be unimpaired and the invalid or unenforceable provision will be deemed modified so that it is valid and enforceable to the maximum extent permitted by law. Your relationship to Company is that of an independent contractor, and neither party is an agent or partner of the other. These Terms, and your rights and obligations herein, may not be assigned, subcontracted, delegated, or otherwise transferred by you without Company’s prior written consent, and any attempted assignment, subcontract, delegation, or transfer in violation of the foregoing will be null and void. Company may freely assign these Terms. The terms and conditions set forth in these Terms shall be binding upon assignees.
10.7 Copyright/Trademark Information.  Copyright © 2026 Cyberscam Watchdog Network. All rights reserved. All trademarks, logos and service marks (“Marks”) displayed on the Site are our property or the property of other third parties. You are not permitted to use these Marks without our prior written consent or the consent of such third party which may own the Marks.
10.8 Contact Information:
Cyberscam Watchdog Network
Address: 524 W Garvey Ave
Monterey Park, CA 91754
Email: report@endscams.org

PRIVACY POLICY | CYBERSCAM WATCHDOG NETWORK

Effective Date: 04‑20, 26

TABLE OF CONTENTS

INTRODUCTION
PERSONAL INFORMATION WE COLLECT
HOW WE COLLECT INFORMATION
USE OF PERSONAL INFORMATION
SHARING AND DISCLOSURE
DATA SECURITY
DATA RETENTION
CHILDREN’S PRIVACY
PARENTAL RIGHTS AND CONSENT
COOKIES AND TRACKING TECHNOLOGIES
LINKS TO OTHER WEBSITES
ANTI‑SPAM POLICY AND YOUR OPT‑OUT RIGHTS
YOUR CONSENT AND QUESTIONS
YOUR RIGHTS AND REQUESTS
CHANGES TO THE PRIVACY POLICY
CONTACT INFORMATION

1. INTRODUCTION

Cyberscam Watchdog Network is a California Public Benefit Nonprofit Corporation (“Cyberscam,” “we,” “our,” “us”). We provide educational resources, tools, and presentations to end scamming through education.

Principal/Mailing Address: 524 W Garvey Ave, Monterey Park, CA 91754
Contact Email: report@endscams.org

Scope. This Privacy Policy explains how we collect, use, disclose, and protect personal information in connection with:

• Our website, including the scam search tool, scam tracker, educational resources, and donation functionality.
• Our virtual and in‑person educational presentations, newsletters, and related services, including our proprietary virtual meeting platform.

Roles. For data we collect directly from website visitors, newsletter subscribers, event attendees, donors, and other users, Cyberscam acts as a data controller. This means we determine the purposes and means of processing your personal information in connection with the services described in this Privacy Policy.

2. PERSONAL INFORMATION WE COLLECT

We collect the following categories of personal information, as permitted by law and subject to your rights:

• Contact Information: Names, email addresses, and phone numbers provided when signing up for newsletters, registering for in‑person or virtual presentations, or contacting us.
• Transaction and Payment Information: If you donate (including recurring donations), we may collect and store credit‑card, debit‑card, or other payment information as processed through secure payment providers.
• Usage and Device Data: IP address, device identifiers, browser type, pages viewed, time zone, and interactions with our website. We do not use cookies or similar tracking technologies.
• Scam Report and Search Data: Phone numbers or other identifiers you submit through our scam search tool or Better Business Bureau (BBB) scam tracker, along with the search results returned. Results from the scam search tool are informational only and are predictive rather than certain; they do not guarantee the legitimacy of any phone number.
• User‑Uploaded Content: Photographs, screenshots, or other images of or information pertaining to potential scams that you upload to our website.
• Support and Communications: Content of inquiries, feedback, and messages you send to us.
• Educational Materials and Downloads: Records of documents, files, or other educational resources that you download from our website.
• Children’s Information: Our website and services are not directed to children under 13, and we do not intentionally collect personal information from children under 13. See the Children’s Privacy and Parental Rights sections below for more information.

3. HOW WE COLLECT INFORMATION

• Direct Collection: When you sign up for our newsletter, register for in‑person or virtual presentations, submit a donation, upload images of potential scams, or communicate with us.
• Through Our Website Tools: When you use our scam search tool, BBB scam tracker, or download educational materials from our website.
• Automatically: Through server logs when you visit our website. We do not use cookies, software development kits (SDKs), or analytics tracking tools.
• From Third Parties: Search results returned by Google, Brave, and Bing in connection with our scam search tool, and scam‑report data from the Better Business Bureau database.

4. USE OF PERSONAL INFORMATION

We use personal information to:

• Provide and operate our scam‑identification tools, including the scam search tool and BBB scam tracker.
• Send newsletters informing subscribers of new scam tactics, educational updates, and other information related to our mission.
• Register and facilitate in‑person and virtual educational presentations, including through our proprietary video‑conferencing platform.
• Process donations, including recurring donations and related billing.
• Provide educational materials, documents, and other resources for online access and download.
• Display and use our original photographs, images, and videos as educational materials on our website and in presentations.
• Comply with legal obligations, enforce our terms, and prevent fraud or misuse.
• Improve our website, tools, and services based on usage patterns and feedback.

5. SHARING AND DISCLOSURE

We do not sell personal information. We may disclose information to:

• Service Providers and Contractors: Hosting providers, payment processors, email service providers, and other vendors that are bound by confidentiality and data‑protection obligations.
• Third‑Party Search and Database Providers: When you use our scam search tool, the phone number or other identifier you enter may be transmitted to Google, Brave, and Bing search engines to return results. When you use our BBB scam tracker, your query may be transmitted to the Better Business Bureau database. These third parties are governed by their own privacy policies.
• Legal and Safety: To comply with applicable law, court orders, or to protect rights, safety, and property.
• Organizational Transactions: In connection with a merger, dissolution, reorganization, or other structural change of our organization, consistent with law and donor restrictions.

6. DATA SECURITY

We maintain an information‑security program designed to protect personal information against unauthorized access, destruction, loss, alteration, or disclosure. Measures include:

• Administrative safeguards such as role‑based access controls and staff training.
• Technical safeguards such as encryption in transit, secure configurations, logging, and monitoring.
• Physical safeguards provided by reputable hosting partners.
• Vendor diligence and contractual safeguards with service providers, including payment processors.
• Incident‑response procedures and notifications consistent with applicable laws.

No system is perfectly secure; we encourage users to use strong passwords and enable available security features. If you provide payment information for recurring donations, we use industry‑standard encryption and security measures to protect that information.

7. DATA RETENTION

We retain personal information for as long as necessary to provide services, comply with legal obligations, resolve disputes, and enforce agreements. We delete or de‑identify data when it is no longer needed, consistent with our retention schedules and applicable law. Payment information for recurring donations is retained for as long as you maintain your recurring donation and is deleted promptly upon cancellation.

8. CHILDREN’S PRIVACY

Our website and services are designed for and directed to adults, especially older adults seeking to learn about and avoid scams. We do not target children under 13 in any way through our website, virtual presentations, newsletters, or other services. While we may occasionally give educational presentations at public venues such as libraries where children could be present, these presentations are directed to adults and are not designed for or marketed to children.

Although as a nonprofit organization we may be exempt from certain requirements of the Children’s Online Privacy Protection Act (COPPA) (16 CFR Part 312), we are committed to protecting children’s privacy and do not knowingly collect personal information from children under 13. We do not employ age‑verification or age‑gating mechanisms on our website; accordingly, we cannot guarantee that a child under 13 will not access our website or submit personal information. If we learn that we have inadvertently collected personal information from a child under 13, we will promptly delete that information. Under the California Privacy Rights Act (CPRA), we do not sell or share the personal information of consumers we know to be under 16 years of age without affirmative authorization as required by law.

9. PARENTAL RIGHTS AND CONSENT

If you are a parent or guardian and believe that your child under 13 has provided personal information to us through our website or services, please contact us at report@endscams.org. You have the right to request that we review, delete, or cease further collection of your child’s information. We will take prompt steps to remove any such information from our records.

10. COOKIES AND TRACKING TECHNOLOGIES

We do not use cookies or similar tracking technologies on our website. Our website does not place cookies on your device, and we do not use web beacons, pixel tags, SDKs, or similar technologies to track your activity.

Because we do not use cookies or tracking technologies, we do not respond to “Do Not Track” browser signals, as there is no tracking to disable. We do not allow third parties to collect personally identifiable information about your online activities over time and across different websites when you use our website. If our practices regarding cookies or tracking technologies change in the future, we will update this Privacy Policy accordingly.

11. LINKS TO OTHER WEBSITES

Our website contains links to third‑party websites and services, including local sheriff’s office websites (accessible via the banner at the top of our website), Google, Brave, and Bing search engines, the Better Business Bureau scam‑tracker website, and other resources. When you click on the sheriff’s‑office banner, you will be redirected to a search‑engine results page that may display your local sheriff’s office based on your device’s location‑service settings and search‑engine preferences; we do not collect, store, or access your location data. If you have location services enabled in your browser, the search engine may return localized results; if location services are disabled, the search engine will return general results. We are not responsible for the privacy practices of any third‑party websites. We encourage you to review their privacy policies before providing personal information.

12. ANTI‑SPAM POLICY AND YOUR OPT‑OUT RIGHTS

We send newsletters and other communications to individuals who have voluntarily provided their email addresses for this purpose. You may unsubscribe from newsletters at any time by following the unsubscribe instructions included in each newsletter or by contacting us using the information provided in Section 10.8. Transactional notices (such as donation receipts or event confirmations) may continue where permitted by law.

13. YOUR CONSENT AND QUESTIONS

By using our website or services, you consent to this Privacy Policy. For questions or to exercise your privacy rights, contact report@endscams.org.

14. YOUR RIGHTS AND REQUESTS

Depending on your location and applicable law, you may have rights to:

• Access, correct, or delete personal information.
• Object to or restrict certain processing.
• Obtain a portable copy of certain information.
• Opt out of targeted advertising or certain disclosures that may be deemed “selling” or “sharing” under California law. Note: We do not currently sell or share personal information.
• Limit use and disclosure of sensitive personal information where applicable.

Request Process. Submit requests to report@endscams.org. We may need to verify your identity and the scope of your request. We do not discriminate against individuals for exercising their rights.

15. CHANGES TO THE PRIVACY POLICY

We may update this Privacy Policy from time to time. The Effective Date at the top indicates the latest revision. Material changes will be posted on our website or communicated through our services. Continued use after changes means you accept the updated Policy.

16. CONTACT INFORMATION

Cyberscam Watchdog Network
524 W Garvey Ave
Monterey Park, CA 91754
Email: report@endscams.org
`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pt-40">
      <div className="max-w-4xl mx-auto px-4 pb-12">
        <div className="card p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-brand-500/10 rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8 text-brand-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Disclaimer: Terms and Conditions &amp; Privacy Policy
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Please read carefully before proceeding
              </p>
            </div>
          </div>

          {/* Updated alert text */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                By clicking "I Accept" below, you acknowledge that you have read, understood, and agree to be bound by all terms and conditions &amp; privacy policy outlined in this disclaimer.
              </p>
            </div>
          </div>

          {/* Full Terms & Privacy Policy */}
          <div className="prose dark:prose-invert max-w-none space-y-6 text-sm mb-8 max-h-[500px] overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-lg p-6 bg-white dark:bg-gray-900">
            <div style={{ whiteSpace: "pre-wrap" }}>{termsAndPrivacy}</div>
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
