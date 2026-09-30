// API Configuration
// This file centralizes all API-related configuration
import { resolveApiBaseUrl } from "./runtimeConfig";

// Base URL from environment variable
const API_BASE_URL = resolveApiBaseUrl();

// Service-specific base URLs
const AUTH_MINI_BASE = `${API_BASE_URL}/auth_mini`;
const MBA_MINI_BASE = `${API_BASE_URL}/mba_mini`;

export const API_ENDPOINTS = {
  // ============================================
  // AUTH_MINI SERVICE - Authentication & Admin
  // ============================================

  // Authentication
  TOKEN: `${AUTH_MINI_BASE}/token`,
  LOGIN: `${AUTH_MINI_BASE}/login`,
  REGISTER: `${AUTH_MINI_BASE}/register`,
  SIGNUP: `${AUTH_MINI_BASE}/signup`,
  LOGOUT: `${AUTH_MINI_BASE}/logout`,

  // Chatbots
  CHATBOTS: `${AUTH_MINI_BASE}/chatbots`,
  CHATBOTS_COMPACT: `${AUTH_MINI_BASE}/chatbots?include_avatar=false&include_prompt=false`,
  CHATBOT_BY_ID: (id) => `${AUTH_MINI_BASE}/chatbots/${id}`,
  TERMS: `${AUTH_MINI_BASE}/terms`,
  ADMIN_TERMS: `${AUTH_MINI_BASE}/admin/terms`,
  ADMIN_DEFAULT_TERM: `${AUTH_MINI_BASE}/admin/terms/default`,
  ADMIN_TERM_BY_KEY: (termKey) => `${AUTH_MINI_BASE}/admin/terms/${encodeURIComponent(termKey)}`,

  // Files (auth_mini endpoints)
  FILE_UPLOAD: `${AUTH_MINI_BASE}/mba/upload`,
  FILE_METADATA: (source) => `${AUTH_MINI_BASE}/mba/files/${source}/metadata`,
  FILE_VIEW: (source, filename) => `${AUTH_MINI_BASE}/mba/files/${source}/view/${filename}`,
  FILE_DELETE: (source, filename) => `${AUTH_MINI_BASE}/mba/files/${source}/delete/${filename}`,
  FILE_DELETE_BY_FILENAME: (source, filename) => `${AUTH_MINI_BASE}/mba/files/${source}/by-filename/${filename}?delete_original_file=true`,

  // Documents (RAG source references / preview)
  DOCUMENT_METADATA: (documentId) => `${AUTH_MINI_BASE}/mba/documents/${documentId}`,
  DOCUMENT_FILE: (documentId, disposition = 'inline') =>
    `${AUTH_MINI_BASE}/mba/documents/${documentId}/file?disposition=${encodeURIComponent(disposition)}`,

  // Versioned AI modules / Agent Creator / Agent sessions (debate, chat, seminar)
  AGENT_MODULES: `${AUTH_MINI_BASE}/mba/modules`,
  AGENT_PROFILES: `${AUTH_MINI_BASE}/mba/agent-profiles`,
  AGENT_PROFILE_JOB: (profileKey, capabilityKey) =>
    `${AUTH_MINI_BASE}/mba/agent-profiles/${encodeURIComponent(profileKey)}/capabilities/${encodeURIComponent(capabilityKey)}/jobs`,
  AGENT_PROFILE_SESSION: (profileKey, capabilityKey) =>
    `${AUTH_MINI_BASE}/mba/agent-profiles/${encodeURIComponent(profileKey)}/capabilities/${encodeURIComponent(capabilityKey)}/sessions`,
  AGENT_MODULE_JOB: (moduleKey) =>
    `${AUTH_MINI_BASE}/mba/modules/${encodeURIComponent(moduleKey)}/jobs`,
  AGENT_MODULE_JOB_STATUS: (jobId) =>
    `${AUTH_MINI_BASE}/mba/modules/jobs/${encodeURIComponent(jobId)}`,
  AGENT_ARTIFACT: (artifactId) =>
    `${AUTH_MINI_BASE}/mba/modules/artifacts/${encodeURIComponent(artifactId)}`,
  AGENT_ARTIFACT_FEEDBACK: (artifactId) =>
    `${AUTH_MINI_BASE}/mba/modules/artifacts/${encodeURIComponent(artifactId)}/feedback`,
  AGENT_SESSION_START: (moduleKey) =>
    `${AUTH_MINI_BASE}/mba/modules/${encodeURIComponent(moduleKey)}/sessions`,
  AGENT_SESSION: (sessionId) =>
    `${AUTH_MINI_BASE}/mba/modules/sessions/${encodeURIComponent(sessionId)}`,
  AGENT_SESSION_TURN: (sessionId) =>
    `${AUTH_MINI_BASE}/mba/modules/sessions/${encodeURIComponent(sessionId)}/turns`,
  AGENT_SESSION_END: (sessionId) =>
    `${AUTH_MINI_BASE}/mba/modules/sessions/${encodeURIComponent(sessionId)}/end`,
  AGENT_DEFINITIONS: (workspaceId) =>
    `${AUTH_MINI_BASE}/mba/agents?workspace_id=${encodeURIComponent(workspaceId)}`,
  AGENT_ARCHIVED_DEFINITIONS: (workspaceId) =>
    `${AUTH_MINI_BASE}/mba/agents?workspace_id=${encodeURIComponent(workspaceId)}&archived=true`,
  AGENT_DEFINITION_CREATE: `${AUTH_MINI_BASE}/mba/agents`,
  AGENT_DEFINITION: (definitionId) =>
    `${AUTH_MINI_BASE}/mba/agents/${encodeURIComponent(definitionId)}`,
  AGENT_DEFINITION_ARCHIVE: (definitionId) =>
    `${AUTH_MINI_BASE}/mba/agents/${encodeURIComponent(definitionId)}`,
  AGENT_DEFINITION_RESTORE: (definitionId) =>
    `${AUTH_MINI_BASE}/mba/agents/${encodeURIComponent(definitionId)}/restore`,
  AGENT_DEFINITION_HARD_DELETE: (definitionId) =>
    `${AUTH_MINI_BASE}/mba/agents/${encodeURIComponent(definitionId)}/hard`,
  AGENT_VERSIONS: (definitionId) =>
    `${AUTH_MINI_BASE}/mba/agents/${encodeURIComponent(definitionId)}/versions`,
  AGENT_VERSION_PUBLISH: (versionId) =>
    `${AUTH_MINI_BASE}/mba/agents/versions/${encodeURIComponent(versionId)}/publish`,
  AGENT_VERSION_GLOBAL_DEFAULT: (versionId, enabled) =>
    `${AUTH_MINI_BASE}/mba/agents/versions/${encodeURIComponent(versionId)}/global-default?enabled=${enabled}`,
  AGENT_VERSION_ARCHIVE: (versionId) =>
    `${AUTH_MINI_BASE}/mba/agents/versions/${encodeURIComponent(versionId)}/archive`,

  // Chat History Management
  CHAT_SESSIONS: (userId, source, limit=30, skip=0) => `${AUTH_MINI_BASE}/mba/user/${userId}/sessions/grouped?source=${source}&limit=${limit}&skip=${skip}`,
  CHAT_SESSION_DETAIL: (sessionId) => `${AUTH_MINI_BASE}/mba/session/${sessionId}`,
  DELETE_CHAT_SESSION: (sessionId) => `${AUTH_MINI_BASE}/mba/session/${sessionId}`,

  // Legacy Chat History (auth_mini)
  CHAT_HISTORY: (userId, limit, skip, source) => `${AUTH_MINI_BASE}/mba/chat_history/${userId}?limit=${limit}&skip=${skip}&source=${source}`,
  DELETE_CHAT_HISTORY: (userId, source) => `${AUTH_MINI_BASE}/mba/chat_history/${userId}?source=${source}`,

  // Quiz
  RANDOM_QUESTIONS: (topic, chapters = []) => {
    const params = new URLSearchParams();
    if (topic) params.set('topic', topic);
    if (chapters.length > 0) params.set('chapters', chapters.join(','));
    return `${AUTH_MINI_BASE}/random-questions?${params.toString()}`;
  },
  QUIZ_CHAPTERS: (topic) => `${AUTH_MINI_BASE}/quiz-chapters?topic=${encodeURIComponent(topic)}`,
  SUBMIT_QUIZ: `${AUTH_MINI_BASE}/submit_quiz`,
  QUIZ_HISTORY: `${AUTH_MINI_BASE}/quiz_history`,

  // Profile
  PROFILE: `${AUTH_MINI_BASE}/profile`,
  USERS_ME: `${AUTH_MINI_BASE}/users/me`,
  CHANGE_PASSWORD: `${AUTH_MINI_BASE}/change-password`,

  // Admin - Chatbots
  ADMIN_CHATBOTS: `${AUTH_MINI_BASE}/admin/chatbots`,
  ADMIN_CHATBOT_BY_ID: (id) => `${AUTH_MINI_BASE}/admin/chatbots/${id}`,
  ADMIN_QUIZ_TOPICS: `${AUTH_MINI_BASE}/admin/quiz-topics`,

  // Admin - Questions
  ADMIN_QUESTIONS: (topic) => `${AUTH_MINI_BASE}/admin/questions/${topic}`,
  ADMIN_QUESTION_CREATE: `${AUTH_MINI_BASE}/admin/question`,
  ADMIN_QUESTIONS_BULK: `${AUTH_MINI_BASE}/admin/questions`,
  ADMIN_QUESTION_BY_ID: (topic, index) => `${AUTH_MINI_BASE}/admin/questions/${topic}/${index}`,
  ADMIN_QUESTIONS_UPLOAD_EXCEL: `${AUTH_MINI_BASE}/admin/questions/upload-excel`,
  ADMIN_SEARCH_QUESTIONS: `${AUTH_MINI_BASE}/admin/search-questions`,

  // Admin - Users
  ADMIN_USERS: `${AUTH_MINI_BASE}/users`,
  ADMIN_USER_ROLE: (username) => `${AUTH_MINI_BASE}/admin/users/${username}/role`,
  ADMIN_USER_ASSIGN_TOPICS: (username) => `${AUTH_MINI_BASE}/admin/users/${username}/assign-topics`,

  // Admin - Logs
  ADMIN_LOGS: `${AUTH_MINI_BASE}/admin/logs`,

  // Admin - API performance dashboard (Langfuse report)
  ADMIN_PERFORMANCE_REPORT: `${AUTH_MINI_BASE}/admin/performance/report`,
  ADMIN_PERFORMANCE_SETTINGS: `${AUTH_MINI_BASE}/admin/performance/settings`,

  // Teacher
  TEACHER_MY_TOPICS: `${AUTH_MINI_BASE}/teacher/my-topics`,
  TEACHER_QUIZ_HISTORY: `${AUTH_MINI_BASE}/teacher/quiz-history`,
  TEACHER_ACTIVITY_STATS: `${AUTH_MINI_BASE}/admin/teacher-stats`,
  TEACHER_ACTIVITY_STATS_EXPORT: `${AUTH_MINI_BASE}/admin/teacher-stats/export`,
  
  // Analytics
  TEACHER_STUDENT_RANKING: (topic, forceRefresh = false) => `${AUTH_MINI_BASE}/teacher/analytics/student-ranking?topic=${encodeURIComponent(topic)}${forceRefresh ? '&force_refresh=true' : ''}`,
  TEACHER_USER_QUESTIONS: (username, topic) => `${AUTH_MINI_BASE}/teacher/analytics/user-questions?username=${encodeURIComponent(username)}&topic=${encodeURIComponent(topic)}`,
  TEACHER_QUESTION_CLUSTERS: (topic, forceRefresh = false) => `${AUTH_MINI_BASE}/teacher/analytics/question-clusters?topic=${encodeURIComponent(topic)}${forceRefresh ? '&force_refresh=true' : ''}`,
  TEACHER_QUESTION_QUALITY: (topic, { forceRefresh = false, useLlm = true } = {}) => {
    const params = new URLSearchParams({ topic });
    if (forceRefresh) params.set('force_refresh', 'true');
    // Always request LLM scoring (backend ignores false and scores with LLM only)
    if (useLlm) params.set('use_llm', 'true');
    return `${AUTH_MINI_BASE}/teacher/analytics/question-quality?${params.toString()}`;
  },

  // AI Q&A (Vấn đáp với AI)
  AI_QA_RANDOM_QUESTION: (topic) => `${AUTH_MINI_BASE}/ai-qa/random-question?topic=${topic}`,
  AI_QA_SUBMIT: `${AUTH_MINI_BASE}/ai-qa/submit`,
  AI_QA_MY_RESPONSES: `${AUTH_MINI_BASE}/ai-qa/my-responses`,
  TEACHER_AI_QA_RESPONSES: `${AUTH_MINI_BASE}/teacher/ai-qa/responses`,
  TEACHER_AI_QA_EVALUATE: (responseId) => `${AUTH_MINI_BASE}/teacher/ai-qa/evaluate/${responseId}`,
  TEACHER_AI_QA_STATS: `${AUTH_MINI_BASE}/teacher/ai-qa/stats`,

  // ============================================
  // MBA_MINI SERVICE - RAG, Search, AI Features
  // ============================================

  // RAG & Chat
  RAG: (time, query, source, save, sessionId) => {
    const params = new URLSearchParams({
      time: String(time || 'anonymous'),
      q: String(query || ''),
      source: String(source || ''),
      save: String(Boolean(save)),
    });
    if (sessionId) params.set('sessionId', sessionId);
    return `${AUTH_MINI_BASE}/mba/rag/?${params.toString()}`;
  },
  RAG_STREAMING: `${AUTH_MINI_BASE}/mba/rag_streaming/`,
  MBA_RAG_TONGHOP: (time, query) => `${MBA_MINI_BASE}/tonghop/?time=${time}&q=${encodeURIComponent(query)}`,
  MBA_EXPLANATION: `${MBA_MINI_BASE}/explanation/`,

  // Search
  MBA_SEARCH: `${MBA_MINI_BASE}/search`,

  // Chroma Management
  MBA_UPDATE_CHROMA: `${MBA_MINI_BASE}/update-chroma`,

  // Source Management
  MBA_SOURCE_USERS: (topic, limit, offset) => `${MBA_MINI_BASE}/source/${encodeURIComponent(topic)}/users?limit=${limit}&skip=${offset}`,

  // ============================================
  // TICKET SYSTEM
  // ============================================

  // User Ticket Endpoints
  TICKET_CREATE: `${AUTH_MINI_BASE}/tickets`,
  TICKET_MY_LIST: (limit, offset, status, type, search) =>
    `${AUTH_MINI_BASE}/tickets/my?limit=${limit}&offset=${offset}${status ? `&status=${status}` : ''}${type ? `&type=${type}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`,
  TICKET_DETAIL: (ticketId) => `${AUTH_MINI_BASE}/tickets/${ticketId}`,
  TICKET_CLOSE: (ticketId) => `${AUTH_MINI_BASE}/tickets/${ticketId}/close`,
  TICKET_REOPEN: (ticketId) => `${AUTH_MINI_BASE}/tickets/${ticketId}/reopen`,
  TICKET_ADD_COMMENT: (ticketId) => `${AUTH_MINI_BASE}/tickets/${ticketId}/comments`,
  TICKET_UPLOAD_ATTACHMENT: `${AUTH_MINI_BASE}/tickets/upload`,
  TICKET_DOWNLOAD_ATTACHMENT: (ticketId, filename) => `${AUTH_MINI_BASE}/tickets/${ticketId}/attachments/${encodeURIComponent(filename)}`,
  TICKET_OPEN_COUNT: `${AUTH_MINI_BASE}/tickets/count/open`,

  // Comment Attachments
  COMMENT_UPLOAD_ATTACHMENT: (commentId) => `${AUTH_MINI_BASE}/tickets/comments/${commentId}/upload`,
  COMMENT_DOWNLOAD_ATTACHMENT: (commentId, filename) => `${AUTH_MINI_BASE}/tickets/comments/${commentId}/attachments/${encodeURIComponent(filename)}`,

  // Admin Ticket Endpoints
  ADMIN_TICKETS_LIST: (limit, offset, status, type, assigned_to, search) =>
    `${AUTH_MINI_BASE}/admin/tickets?limit=${limit}&offset=${offset}${status ? `&status=${status}` : ''}${type ? `&type=${type}` : ''}${assigned_to ? `&assigned_to=${encodeURIComponent(assigned_to)}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`,
  ADMIN_TICKET_UPDATE: (ticketId) => `${AUTH_MINI_BASE}/admin/tickets/${ticketId}`,
  ADMIN_TICKET_DELETE: (ticketId) => `${AUTH_MINI_BASE}/admin/tickets/${ticketId}`,
  ADMIN_TICKET_STATS: `${AUTH_MINI_BASE}/admin/tickets/stats`,

  // Ratings / Feedback
  RATING_SUBMIT: `${AUTH_MINI_BASE}/ratings`,
  RATING_CHECK: `${AUTH_MINI_BASE}/ratings/check`,
  ADMIN_RATINGS: `${AUTH_MINI_BASE}/admin/ratings`,
};

export default API_BASE_URL;
