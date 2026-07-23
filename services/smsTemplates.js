// ─────────────────────────────────────────────────────────────────────────────
// SMS Template Builders — Office of Kothamangalam MLA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Template 1 — Submission Confirmation
 * Sent immediately after a constituent submits a Complaint / Issue / Suggestion / Idea / Application.
 *
 * @param {object} opts
 * @param {string} opts.name          - Complainant / submitter name
 * @param {string} opts.dateFiled     - Date the record was filed
 * @param {string} opts.referenceNo   - e.g. C-001, P-002, S-003, I-004
 */
export const submissionConfirmationSMS = ({ name, dateFiled, referenceNo }) => {
    const d = new Date(dateFiled);
    const dateStr = !isNaN(d) ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : dateFiled;
    return `Hi ${name},\n\nApplication received: ${dateStr}\nWe are reviewing your submission.\nTracking ID: ${referenceNo}\n\nOffice of Kothamangalam MLA`;
};

/**
 * Template 2 — Follow-up / Status Update
 * Sent when an admin adds an update and enables "Notify Complainant via SMS".
 *
 * @param {object} opts
 * @param {string} opts.name          - Complainant / submitter name
 * @param {string} opts.referenceNo   - e.g. C-001, P-002, S-003, I-004
 * @param {string} opts.statusTitle   - The title field of the follow-up update (e.g. "Letter submitted to Health Minister")
 * @param {string} opts.moduleLabel   - Human-readable module label: "Complaint", "Application", "Idea", "Suggestion", "Public Issue"
 * @param {Date|string} opts.updateDate - Date of this update (defaults to now)
 */
export const followUpUpdateSMS = ({ name, referenceNo, statusTitle, moduleLabel, updateDate }) => {
    const d = new Date(updateDate || Date.now());
    const dateStr = !isNaN(d) ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : String(updateDate || '');
    const label = moduleLabel || 'Application';
    return `Hi ${name},\n\nYour ${label} Update: ${dateStr}\nTracking ID: ${referenceNo}\nStatus: ${statusTitle}\n\nOffice of Kothamangalam MLA`;
};
