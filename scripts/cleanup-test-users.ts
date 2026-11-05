/** Deletes leftover throwaway users (qa-automation+…) and test reports/suggestions. */
import { adminClient, cleanupStaleTestUsers, QA_MARKER } from '../src/support/supabase.js';

const minutes = Number(process.argv[2] ?? 0);
await cleanupStaleTestUsers(minutes);
const admin = adminClient();
await admin.from('quiz_reports').delete().like('note', `${QA_MARKER}%`);
await admin.from('quiz_suggestions').delete().like('question', `${QA_MARKER}%`);
await admin.from('quiz_questions').delete().like('id', 'qa-%');
console.log(`Removed test users older than ${minutes} min and test reports, suggestions and questions.`);
