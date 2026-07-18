// ─────────────────────────────────────────────────────────────────────────────
// SMS Template Builders — Office of Shibu Theckumpuram MLA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Template 1 — Submission Confirmation
 * Sent immediately after a constituent submits a Complaint / Issue / Suggestion / Idea.
 *
 * @param {object} opts
 * @param {string} opts.name          - Complainant / submitter name
 * @param {string} opts.dateFiled     - Date the record was filed
 * @param {string} opts.referenceNo   - e.g. C-001, P-002, S-003, I-004
 * @param {string} opts.status        - e.g. Pending, Submitted
 */
export const submissionConfirmationSMS = ({ name, dateFiled, referenceNo, status }) => {
    const d = new Date(dateFiled);
    const dateStr = !isNaN(d) ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : dateFiled;
    return `Hi ${name},\n\nApplication received: ${dateStr}\nTracking ID: ${referenceNo}\nStatus: ${status}\n\nOffice of Kothamangalam MLA`;
};

/**
 * Template 2 — Follow-up / Status Update
 * Sent when an admin adds an update and enables "Notify Complainant via SMS".
 *
 * @param {object} opts
 * @param {string} opts.name          - Complainant / submitter name
 * @param {string} opts.referenceNo   - e.g. C-001, P-002, S-003, I-004
 * @param {string} opts.status        - Current status of the record
 * @param {string} opts.department    - Assigned department name (optional)
 */
export const followUpUpdateSMS = ({ name, referenceNo, status, department }) =>
    `Hi ${name},\n\nUpdate for Reference ID: ${referenceNo}\nCurrent Status: ${status}\nYour submission is currently under review by the ${department || 'concerned'} department.\n\nOffice of Shibu Theckumpuram MLA`;
