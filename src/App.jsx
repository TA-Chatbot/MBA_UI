import { useEffect, useState, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useTokenRefresh } from './hooks/useTokenRefresh';
import RatingPopup from "./components/RatingPopup";
import { API_ENDPOINTS } from "./config/api";

import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";

const ChatBot = lazy(() => import("./components/ChatBot"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const Profile = lazy(() => import("./pages/Profile"));
const QuizHistory = lazy(() => import("./pages/QuizHistory"));
const Test = lazy(() => import("./pages/Test"));
const EditPage = lazy(() => import("./pages/EditPage"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminStudentAnalytics = lazy(() => import("./pages/AdminStudentAnalytics"));
const AdminTermManager = lazy(() => import("./pages/AdminTermManager"));
const SourceManager = lazy(() => import("./pages/SourceManager"));
const QuestionManager = lazy(() => import("./pages/QuestionManager"));
const UserManager = lazy(() => import("./pages/UserManager"));
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard"));
const TeacherQuizHistory = lazy(() => import("./pages/TeacherQuizHistory"));
const TeacherStats = lazy(() => import("./pages/TeacherStats"));
const TeacherAnalytics = lazy(() => import("./pages/TeacherAnalytics"));
const MessageManager = lazy(() => import("./pages/MessageManager"));
const AdminLogs = lazy(() => import("./pages/AdminLogs"));
const AuthSuccess = lazy(() => import('./components/AuthSuccess.jsx'));
const AIQAPage = lazy(() => import('./pages/AIQAPage'));
const TeacherAIQA = lazy(() => import('./pages/TeacherAIQA'));
const StudyWithAmi = lazy(() => import('./pages/StudyWithAmi'));
const MyTickets = lazy(() => import("./pages/MyTickets"));
const AdminTickets = lazy(() => import("./pages/AdminTickets"));
const AdminRatings = lazy(() => import("./pages/AdminRatings"));
const AdminPerformance = lazy(() => import("./pages/AdminPerformance"));

const LoadingFallback = () => (
  <div className="min-h-screen bg-gradient-to-br from-red-100 to-pink-100 flex items-center justify-center">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-red-600"></div>
  </div>
);

function App() {
  useEffect(() => { }, []);
  const [currentPage, SetCurrentPage] = useState("Home");
  const [showRatingPopup, setShowRatingPopup] = useState(false);

  useTokenRefresh();

  useEffect(() => {
    const shouldCheck = sessionStorage.getItem('check_rating');
    if (!shouldCheck) return;
    const token = localStorage.getItem('access_token');
    if (!token) return;
    sessionStorage.removeItem('check_rating');
    fetch(API_ENDPOINTS.RATING_CHECK, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => { if (!data.has_rated) setShowRatingPopup(true); })
      .catch(() => {});
  }, []);

  return (
    <BrowserRouter basename="/mini" future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="App">
        {showRatingPopup && <RatingPopup onClose={() => setShowRatingPopup(false)} />}
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/mini" element={<PrivateRoute><ChatBot /></PrivateRoute>} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/account" element={<PrivateRoute><Profile /></PrivateRoute>} />
            <Route path="/quiz-history" element={<PrivateRoute><QuizHistory /></PrivateRoute>} />
            <Route path="/test" element={<PrivateRoute><Test /></PrivateRoute>} />
            <Route path="/edit" element={<PrivateRoute><EditPage /></PrivateRoute>} />
            <Route path="/admin" element={<PrivateRoute><AdminDashboard /></PrivateRoute>} />
            <Route path="/admin/student-analytics" element={<PrivateRoute><AdminStudentAnalytics /></PrivateRoute>} />
            <Route path="/admin/terms" element={<PrivateRoute><AdminTermManager /></PrivateRoute>} />
            <Route path="/teacher-stats" element={<PrivateRoute><TeacherStats /></PrivateRoute>} />
            <Route path="/sources" element={<PrivateRoute><SourceManager /></PrivateRoute>} />
            <Route path="/questions" element={<PrivateRoute><QuestionManager /></PrivateRoute>} />
            <Route path="/users" element={<PrivateRoute><UserManager /></PrivateRoute>} />
            <Route path="/teacher" element={<PrivateRoute><TeacherDashboard /></PrivateRoute>} />
            <Route path="/teacher-analytics" element={<PrivateRoute><TeacherAnalytics /></PrivateRoute>} />
            <Route path="/teacher/quiz-history" element={<PrivateRoute><TeacherQuizHistory /></PrivateRoute>} />
            <Route path="/messages" element={<PrivateRoute><MessageManager /></PrivateRoute>} />
            <Route path="/logs" element={<PrivateRoute><AdminLogs /></PrivateRoute>} />
            <Route path="/ai-qa" element={<PrivateRoute><AIQAPage /></PrivateRoute>} />
            <Route path="/teacher/ai-qa" element={<PrivateRoute><TeacherAIQA /></PrivateRoute>} />
            <Route path="/study-with-ami" element={<PrivateRoute><StudyWithAmi /></PrivateRoute>} />
            <Route path="/ratings" element={<PrivateRoute><AdminRatings /></PrivateRoute>} />
            <Route path="/tickets" element={<PrivateRoute><MyTickets /></PrivateRoute>} />
            <Route path="/admin/tickets" element={<AdminRoute><AdminTickets /></AdminRoute>} />
            <Route path="/admin/performance" element={<AdminRoute><AdminPerformance /></AdminRoute>} />
            <Route path="/access-auth" element={<AuthSuccess />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>

        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
      </div>
    </BrowserRouter>
  );
}

function PrivateRoute({ children }) {
  const token = localStorage.getItem('access_token');
  return token ? children : <Navigate to="/login" replace />;
}

/**
 * Admin-only route. The backend already enforces this, but without a client-side
 * gate a student navigating to /admin/tickets got a fully rendered admin console
 * - stat cards, table, delete buttons - that simply failed every request. Now
 * they are sent to their own ticket list instead.
 */
function AdminRoute({ children }) {
  const token = localStorage.getItem('access_token');
  if (!token) return <Navigate to="/login" replace />;
  if (localStorage.getItem('user_role') !== 'admin') return <Navigate to="/tickets" replace />;
  return children;
}

export default App;
