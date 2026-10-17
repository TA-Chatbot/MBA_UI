import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { FaMicrophone, FaPaperPlane, FaQuestionCircle, FaVolumeMute, FaVolumeUp, FaHistory, FaTrash } from "react-icons/fa";
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { API_ENDPOINTS } from '../config/api';
import QuizPopup from './QuizPopup';
import { jwtDecode } from 'jwt-decode';
import { Info, Minus, Plus, X } from 'lucide-react';

const timestamp = `${Date.now()}-${uuidv4()}`;

// Convert các delimiter LaTeX không chuẩn sang $...$ / $$...$$ để remark-math nhận được
const preprocessMath = (text) => {
  if (!text) return text;

  // \[...\] → $$...$$ (display/block math)
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, m) => `\n$$\n${m.trim()}\n$$\n`);

  // \(...\) → $...$ (inline math)
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, m) => `$${m}$`);

  // Bare [ ... ] trên dòng riêng có chứa lệnh LaTeX → $$...$$
  text = text.replace(/^[ \t]*\[([^\[\]\n]*\\[a-zA-Z][^\[\]\n]*)\][ \t]*$/gm, (_, m) => `$$${m.trim()}$$`);

  // Bare ( ... ) inline có chứa lệnh LaTeX (vd: \times, \sigma) → $...$
  text = text.replace(/(?<![a-zA-Z\d])\(([^()]*(?:\([^()]*\)[^()]*)*)\)(?![a-zA-Z\d])/g, (match, inner) => {
    if (/\\[a-zA-Z]/.test(inner)) {
      return `$${inner.trim()}$`;
    }
    return match;
  });

  return text;
};

const REMARK_PLUGINS = [remarkGfm, remarkMath];
const REHYPE_PLUGINS = [rehypeKatex];

// Hoisted ra module scope: nếu khai báo inline trong JSX thì mỗi render tạo
// object mới, ReactMarkdown không bail-out được và parse lại toàn bộ markdown.
const MD_COMPONENTS = {
  h1: ({node, ...props}) => <h1 className="text-base font-bold mt-2 mb-1" {...props} />,
  h2: ({node, ...props}) => <h2 className="text-sm font-bold mt-2 mb-1" {...props} />,
  h3: ({node, ...props}) => <h3 className="text-sm font-semibold mt-1 mb-1" {...props} />,
  p: ({node, ...props}) => <p className="mb-1 last:mb-0 leading-relaxed" {...props} />,
  ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-1 space-y-0.5" {...props} />,
  ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-1 space-y-0.5" {...props} />,
  li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
  strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
  em: ({node, ...props}) => <em className="italic" {...props} />,
  pre: ({node, ...props}) => <pre className="bg-gray-900 text-gray-100 rounded p-3 my-2 overflow-x-auto text-xs font-mono" {...props} />,
  code: ({node, className, children, ...props}) => {
    const isBlock = /language-(\w+)/.test(className || '');
    return isBlock
      ? <code className={`${className} text-xs font-mono`} {...props}>{children}</code>
      : <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-xs font-mono" {...props}>{children}</code>;
  },
  blockquote: ({node, ...props}) => <blockquote className="border-l-2 border-gray-400 pl-3 italic text-gray-500 my-1" {...props} />,
  a: ({node, ...props}) => <a className="text-blue-500 underline hover:text-blue-700" target="_blank" rel="noopener noreferrer" {...props} />,
  hr: ({node, ...props}) => <hr className="my-2 border-gray-300" {...props} />,
  table: ({node, ...props}) => <div className="overflow-x-auto my-2"><table className="border-collapse text-xs w-full" {...props} /></div>,
  thead: ({node, ...props}) => <thead className="bg-gray-50" {...props} />,
  th: ({node, ...props}) => <th className="border border-gray-300 px-2 py-1 font-semibold text-left" {...props} />,
  td: ({node, ...props}) => <td className="border border-gray-300 px-2 py-1" {...props} />,
  tr: ({node, ...props}) => <tr className="even:bg-gray-50" {...props} />,
};

// Một row là hàm thuần của `message`. memo() so sánh shallow prop `message`:
// khi stream token, applyBotUpdate chỉ thay object của bubble đang chạy nên
// các tin nhắn còn lại giữ nguyên identity và bỏ qua được re-render.
const ChatMessageRow = memo(function ChatMessageRow({ message }) {
  const mdText = useMemo(() => preprocessMath(message.text || ''), [message.text]);

  return (
    <div className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
      <div className={`${message.sender === "user" ? "max-w-xs lg:max-w-md xl:max-w-lg" : "max-w-[90%]"} ${message.sender === "user" ? "bg-blue-600 text-white" : "bg-white text-gray-800"} rounded-lg p-3 ${message.sender === "user" ? "rounded-br-none" : "rounded-bl-none"} shadow-md break-words ${message.historyId ? "opacity-90 border-l-4 border-gray-300" : ""}`}>
        <ReactMarkdown
          className="text-sm whitespace-normal mb-1"
          remarkPlugins={REMARK_PLUGINS}
          rehypePlugins={REHYPE_PLUGINS}
          components={MD_COMPONENTS}
        >{mdText}</ReactMarkdown>
        {message.streaming && (
          <span
            className="inline-block w-1.5 h-4 ml-0.5 bg-blue-500 align-middle"
            style={{ animation: 'pulse 1s ease-in-out infinite' }}
            aria-hidden
          />
        )}
        <div className="flex justify-between items-center mt-2 text-xs">
          <p className={`${message.sender === "user" ? "text-blue-200" : "text-gray-500"}`}>
            {message.historyId && <span className="text-xs opacity-70">📜 </span>}
            {message.streaming ? 'Đang trả lời...' : message.timestamp}
          </p>
          {/* {message.sender === "bot" && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleToggleSpeaker(message.text)}
                className="text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                {isSpeakerActive ? (
                  <FaVolumeUp className="w-4 h-4" />
                ) : (
                  <FaVolumeMute className="w-4 h-4" />
                )}
              </button>
              {message.sources && (
                <button
                  onClick={() => toggleSourcePopup(message.sources)}
                  className="text-blue-500 hover:underline focus:outline-none"
                >
                  View Sources
                </button>
              )}
            </div>
          )} */}
        </div>
      </div>
    </div>
  );
});

const UnifiedChatbot = ({
  chatbotConfig, // { id, name, source, quizTopic, avatar }
  isSpeakerActive,
  toggleSpeaker,
  speakText,
  toggleSourcePopup,
  isLoading,
  setIsLoading,
}) => {
  const [inputMessage, setInputMessage] = useState("");
  const [isVoiceInputActive, setIsVoiceInputActive] = useState(false);
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [apiUrl, setApiUrl] = useState("");
  const [showChapterSelector, setShowChapterSelector] = useState(false);
  const [availableChapters, setAvailableChapters] = useState([]);
  const [availableQuestionCount, setAvailableQuestionCount] = useState(0);
  const [selectedChapters, setSelectedChapters] = useState([]);
  const [quizSelectionMode, setQuizSelectionMode] = useState("random");
  const [quizQuestionCount, setQuizQuestionCount] = useState(10);
  const [quizRangeStart, setQuizRangeStart] = useState(1);
  const [answerDisplayMode, setAnswerDisplayMode] = useState("sequential");
  const [orderedPracticeScope, setOrderedPracticeScope] = useState(null);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success"); // success, error
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const chatHistoryRef = useRef(null);
  const speechRecognition = useRef(null);
  const inactivityTimerRef = useRef(null);
  const textareaRef = useRef(null);

  // Các tin nhắn loading thú vị (memoized)
  const loadingMessages = useMemo(() => [
    { text: "Trợ lý AI đang suy nghĩ...", emoji: "💭", subtitle: "Đang xử lý câu hỏi của bạn" },
    { text: "Đang tìm kiếm thông tin...", emoji: "🔍", subtitle: "Chờ chút nhé, sắp có kết quả rồi" },
    { text: "Đang phân tích dữ liệu...", emoji: "📊", subtitle: "Hệ thống đang làm việc chăm chỉ" },
    { text: "Chuẩn bị câu trả lời...", emoji: "✨", subtitle: "Sắp xong rồi, kiên nhẫn tí nha" },
    { text: "Đang kết nối với AI...", emoji: "🤖", subtitle: "Trí tuệ nhân tạo đang hoạt động" }
  ], []);

  // Trích xuất userId từ access_token
  const accessToken = localStorage.getItem('access_token');
  let username = null;

  if (accessToken) {
    try {
      const decodedToken = jwtDecode(accessToken);
      username = decodedToken.sub;
    } catch (error) {
      console.error('Failed to decode access token:', error);
    }
  }

  const sessionStorageKey = useMemo(
    () => `mba-course-session:${username || 'anonymous'}:${chatbotConfig.source || 'unknown'}`,
    [username, chatbotConfig.source]
  );

  const rememberSessionId = useCallback((value) => {
    const normalized = String(value || '').trim();
    if (!normalized) return null;
    sessionStorage.setItem(sessionStorageKey, normalized);
    setSessionId(normalized);
    return normalized;
  }, [sessionStorageKey]);

  const ensureSessionId = useCallback(() => {
    const existing = sessionStorage.getItem(sessionStorageKey);
    return rememberSessionId(existing || uuidv4());
  }, [rememberSessionId, sessionStorageKey]);

  // Function để format lịch sử chat từ API thành format message
  const formatChatHistoryToMessages = useCallback((chatHistoryData) => {
    const formattedMessages = [];

    chatHistoryData.forEach(chatItem => {
      // Thêm tin nhắn của user
      formattedMessages.push({
        id: `user-${chatItem._id}`,
        text: chatItem.message,
        sender: "user",
        timestamp: new Date(chatItem.timestamp).toLocaleTimeString(),
        historyId: chatItem._id
      });

      // Xử lý response của bot
      let botText = "";
      let sources = [];

      if (typeof chatItem.response === 'string') {
        botText = chatItem.response;
      } else if (chatItem.response && typeof chatItem.response === 'object') {
        if (chatItem.response.response) {
          botText = chatItem.response.response;
        } else {
          botText = JSON.stringify(chatItem.response);
        }

        if (chatItem.response.sources && Array.isArray(chatItem.response.sources)) {
          sources = chatItem.response.sources;
        }
      }

      // Thêm tin nhắn của bot
      formattedMessages.push({
        id: `bot-${chatItem._id}`,
        text: botText,
        sender: "bot",
        timestamp: new Date(chatItem.timestamp).toLocaleTimeString(),
        sources: sources,
        historyId: chatItem._id
      });
    });

    return formattedMessages;
  }, []);

  // Function để load lịch sử chat
  const loadChatHistory = useCallback(async () => {
    if (!username || !chatbotConfig.source) return;

    setIsLoadingHistory(true);
    try {
      const token = localStorage.getItem('access_token');
      const headers = {
        "accept": "application/json",
        "ngrok-skip-browser-warning": "69420",
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(
        API_ENDPOINTS.CHAT_HISTORY(username, 50, 0, chatbotConfig.source),
        {
          method: "GET",
          headers: headers,
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.status === "ok" && data.chat_history && data.chat_history.length > 0) {
          const formattedHistory = formatChatHistoryToMessages(data.chat_history.reverse());
          setChatHistory(formattedHistory);
          setMessages(formattedHistory);
        } else {
          setChatHistory([]);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      setChatHistory([]);
      setMessages([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [username, chatbotConfig.source, formatChatHistoryToMessages]);

  // Function để hiển thị toast notification
  const showToastNotification = useCallback((message, type = "success") => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  }, []);

  // Function để xóa lịch sử chat
  const clearChatHistory = useCallback(async () => {
    if (!username || !chatbotConfig.source) return;
    setShowDeleteConfirm(true);
  }, [username, chatbotConfig.source]);

  // Function để xác nhận xóa lịch sử chat
  const confirmClearHistory = useCallback(async () => {
    setShowDeleteConfirm(false);
    setIsLoadingHistory(true);

    try {
      const token = localStorage.getItem('access_token');
      const headers = {
        "accept": "application/json",
        "ngrok-skip-browser-warning": "69420",
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(
        API_ENDPOINTS.DELETE_CHAT_HISTORY(username, chatbotConfig.source),
        {
          method: "DELETE",
          headers: headers,
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.status === "ok") {
          setChatHistory([]);
          setMessages([]);
          rememberSessionId(uuidv4());
          showToastNotification(`🎉 Đã xóa thành công ${data.deleted_count} tin nhắn chat!`, "success");
        }
      } else {
        showToastNotification("❌ Có lỗi xảy ra khi xóa lịch sử chat. Vui lòng thử lại sau.", "error");
      }
    } catch (error) {
      console.error('Error clearing chat history:', error);
      showToastNotification("❌ Có lỗi xảy ra khi xóa lịch sử chat. Vui lòng thử lại sau.", "error");
    } finally {
      setIsLoadingHistory(false);
    }
  }, [username, chatbotConfig.source, rememberSessionId, showToastNotification]);

  const openQuizPractice = useCallback((chapters = [], mode = "random", count = 10, rangeStart = null, rangeEnd = null) => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (mode === "ordered") {
      setOrderedPracticeScope({ topic: chatbotConfig.quizTopic, chapters, range_start: rangeStart, range_end: rangeEnd });
      setApiUrl(API_ENDPOINTS.ORDERED_PRACTICE_BATCH(chatbotConfig.quizTopic, chapters, count, rangeStart, rangeEnd));
    } else {
      setOrderedPracticeScope(null);
      setApiUrl(API_ENDPOINTS.RANDOM_QUESTIONS(chatbotConfig.quizTopic, chapters, mode, count, rangeStart, rangeEnd));
    }
    setIsQuizOpen(true);
  }, [chatbotConfig.quizTopic]);

  const selectedChapter = availableChapters.find((chapter) => chapter.value === selectedChapters[0]);
  const selectedQuestionTotal = selectedChapter?.count ?? availableQuestionCount;
  const maxQuestionCount = selectedQuestionTotal > 0 ? selectedQuestionTotal : 50;
  const enteredQuestionCount = Number(quizQuestionCount);
  const effectiveQuestionBatchSize = Number.isInteger(enteredQuestionCount) && enteredQuestionCount > 0
    ? Math.min(enteredQuestionCount, maxQuestionCount)
    : Math.min(50, maxQuestionCount);
  const selectedRangeEnd = selectedQuestionTotal > 0
    ? Math.min(quizRangeStart + effectiveQuestionBatchSize - 1, selectedQuestionTotal)
    : quizRangeStart + effectiveQuestionBatchSize - 1;
  const selectedRangeCount = selectedRangeEnd == null
    ? effectiveQuestionBatchSize
    : Math.max(0, selectedRangeEnd - quizRangeStart + 1);
  const questionCountError = quizQuestionCount === ""
    ? "Nhập số câu hỏi cần luyện tập."
    : !Number.isInteger(enteredQuestionCount) || enteredQuestionCount < 1
      ? "Số câu hỏi phải là số nguyên lớn hơn 0."
      : enteredQuestionCount > maxQuestionCount
        ? `Bạn nhập ${enteredQuestionCount} câu nhưng ${selectedChapter ? selectedChapter.label : "môn này"} chỉ có ${maxQuestionCount} câu. Hãy nhập số không vượt quá ${maxQuestionCount}.`
        : "";
  const questionCountPresets = [...new Set([10, 20, 40, 50, 100, maxQuestionCount])]
    .filter((count) => count <= maxQuestionCount && (count <= 100 || count === maxQuestionCount))
    .sort((a, b) => a - b);
  const questionRangeOptions = selectedQuestionTotal > 0
    ? Array.from({ length: Math.ceil(selectedQuestionTotal / effectiveQuestionBatchSize) }, (_, index) => ({
        start: index * effectiveQuestionBatchSize + 1,
        end: Math.min((index + 1) * effectiveQuestionBatchSize, selectedQuestionTotal),
      }))
    : [];

  const updateQuestionCount = (value) => {
    setQuizQuestionCount(value);
    const nextCount = Number(value);
    if (Number.isInteger(nextCount) && nextCount > 0) {
      setQuizRangeStart((currentStart) => selectedQuestionTotal > 0
        ? Math.floor((currentStart - 1) / nextCount) * nextCount + 1
        : 1);
    }
  };

  const handleStartQuizWithSelectedChapters = useCallback(() => {
    if (availableChapters.length > 0 && selectedChapters.length === 0) {
      showToastNotification("Vui lòng chọn ít nhất một chương để luyện tập.", "error");
      return;
    }
    const requestedCount = Number(quizQuestionCount);
    if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > maxQuestionCount) {
      showToastNotification(`Số câu phải từ 1 đến ${maxQuestionCount}.`, "error");
      return;
    }

    setShowChapterSelector(false);
    const hasQuestionRanges = quizSelectionMode !== "random" && (selectedChapter || availableQuestionCount > 0);
    const rangeEnd = hasQuestionRanges ? Math.min(quizRangeStart + 49, selectedChapter?.count ?? availableQuestionCount) : null;
    openQuizPractice(selectedChapters, quizSelectionMode, requestedCount, hasQuestionRanges ? quizRangeStart : null, rangeEnd);
  }, [availableChapters, availableQuestionCount, maxQuestionCount, openQuizPractice, quizQuestionCount, quizRangeStart, quizSelectionMode, selectedChapter, selectedChapters, showToastNotification]);

  const handleOpenQuiz = useCallback(async () => {
    if (!chatbotConfig.quizTopic || chatbotConfig.quizTopic === "tonghop") {
      setAvailableChapters([]);
      setAvailableQuestionCount(0);
      setSelectedChapters([]);
      setQuizSelectionMode("random");
      setQuizQuestionCount(10);
      setQuizRangeStart(1);
      setShowChapterSelector(true);
      return;
    }

    setIsLoadingChapters(true);
    try {
      const response = await fetch(API_ENDPOINTS.QUIZ_CHAPTERS(chatbotConfig.quizTopic));
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Không thể tải danh sách chương.");
      }

      const chapters = data.chapters || [];
      setAvailableChapters(chapters);
      setAvailableQuestionCount(data.total_questions || 0);
      setSelectedChapters(chapters.length ? [chapters[0].value] : []);
      setQuizSelectionMode("ordered");
      setQuizQuestionCount(Math.min(50, chapters[0]?.count || data.total_questions || 10));
      setQuizRangeStart(1);
      setAnswerDisplayMode("sequential");
      setShowChapterSelector(true);
    } catch (error) {
      console.error("Error loading quiz chapters:", error);
      showToastNotification(error.message || "Không thể tải danh sách chương.", "error");
      setAvailableChapters([]);
      setAvailableQuestionCount(0);
      setSelectedChapters([]);
      setShowChapterSelector(false);
    } finally {
      setIsLoadingChapters(false);
    }
  }, [chatbotConfig.quizTopic, showToastNotification]);

  const handleExplanationRequest = useCallback(async (explanationData) => {
    const dataToSend = { ...explanationData, source: chatbotConfig.source };
    setIsLoading(true);

    try {
      const response = await fetch(API_ENDPOINTS.MBA_EXPLANATION, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server Error: ${response.status}`);
      }

      const data = await response.json();
      if (data.explanations && data.explanations[0]) {
        let explanation = data.explanations[0].explanation;
        if (typeof explanation !== 'string') {
          if (explanation.text && typeof explanation.text === 'string') {
            explanation = explanation.text;
          } else {
            explanation = JSON.stringify(explanation);
          }
        }
        let parsedText;
        try {
          parsedText = JSON.parse(explanation);
        } catch (parseError) {
          parsedText = { response: explanation, sources: [] };
        }
        const extractedText = parsedText.response || explanation;
        const sources = parsedText.sources || [];
        const botMessage = {
          id: uuidv4(),
          text: extractedText,
          sender: "bot",
          timestamp: new Date().toLocaleTimeString(),
          sources: sources,
        };
        setMessages(prev => [...prev, botMessage]);
        if (isSpeakerActive) {
          speakText(botMessage.text);
        }
      }
    } catch (error) {
      const errorMessage = {
        id: uuidv4(),
        text: "Có lỗi xảy ra khi tải giải thích. Vui lòng thử lại sau.",
        sender: "bot",
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [chatbotConfig.source, isSpeakerActive, speakText, setIsLoading]);

  const formatSourceLabels = useCallback((rawSources) => {
    if (!Array.isArray(rawSources)) return [];
    return rawSources.map((source) => {
      if (typeof source === 'string') return source;
      const name = source.file_name || source.file_path || 'Tài liệu';
      const snippet = source.text || source.section_summary || '';
      const short = String(snippet).length > 200 ? `${String(snippet).slice(0, 200)}...` : snippet;
      return short ? `${name}: ${short}` : name;
    });
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (inputMessage.trim() !== "" && !isLoading) {
      setIsLoading(true);
      setLoadingMessageIndex(0);

      const questionText = inputMessage.trim();
      const newMessage = {
        id: uuidv4(),
        text: questionText,
        sender: "user",
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages(prev => [...prev, newMessage]);
      setInputMessage("");

      try {
        const activeSessionId = sessionId || ensureSessionId();
        const token = localStorage.getItem('access_token');
        const headers = new Headers({
          "ngrok-skip-browser-warning": "69420",
        });

        // Chatbot tổng hợp (id === 0): giữ GET non-stream cũ
        if (chatbotConfig.id === 0) {
          const apiEndpoint = API_ENDPOINTS.MBA_RAG_TONGHOP(timestamp, questionText);
          const response = await fetch(apiEndpoint, { method: "GET", headers });
          const result = await response.json();
          const botResponse = {
            id: uuidv4(),
            text: result.text,
            sender: "bot",
            timestamp: new Date().toLocaleTimeString(),
            sources: Object.entries(result.source || {}).map(([key, value]) => `${key}: ${value}`),
          };
          setMessages(prev => [...prev, botResponse]);
          if (isSpeakerActive) speakText(botResponse.text);
          return;
        }

        // Chat thường: SSE streaming (1 bubble). Lỗi → fallback GET /rag/ cùng bubble.
        if (token) {
          headers.append('Authorization', `Bearer ${token}`);
        }

        const botId = uuidv4();
        let fullText = '';
        let gotFirstToken = false;
        let botBubbleCreated = false;

        // Chỉ tạo 1 bubble bot khi có token đầu (tránh 2 ô: ▋ + loading)
        const ensureBotBubble = () => {
          if (botBubbleCreated) return;
          botBubbleCreated = true;
          setIsLoading(false); // tắt spinner loading — chỉ còn bubble stream
          setMessages(prev => [...prev, {
            id: botId,
            text: '',
            sender: 'bot',
            timestamp: new Date().toLocaleTimeString(),
            sources: [],
            streaming: true,
          }]);
        };

        const applyBotUpdate = (patch) => {
          ensureBotBubble();
          setMessages(prev => prev.map((m) => (m.id === botId ? { ...m, ...patch } : m)));
        };

        const finishWithNonStream = async () => {
          const apiEndpoint = API_ENDPOINTS.RAG(
            username || 'anonymous',
            questionText,
            chatbotConfig.source,
            true,
            activeSessionId
          );
          const h = new Headers({ "ngrok-skip-browser-warning": "69420" });
          if (token) h.append('Authorization', `Bearer ${token}`);
          const response = await fetch(apiEndpoint, { method: 'GET', headers: h });
          if (!response.ok) {
            throw new Error(`RAG HTTP ${response.status}`);
          }
          const result = await response.json();
          if (result.session_id) rememberSessionId(result.session_id);
          const answerPayload = result.answer || {};
          const text = answerPayload.response || (typeof answerPayload === 'string' ? answerPayload : '') || '';
          fullText = text;
          applyBotUpdate({
            text: text || 'Không nhận được phản hồi.',
            sources: formatSourceLabels(answerPayload.sources || []),
            streaming: false,
          });
          if (text && isSpeakerActive) speakText(text);
        };

        try {
          const streamHeaders = new Headers(headers);
          streamHeaders.append('Content-Type', 'application/json');
          streamHeaders.append('Accept', 'text/event-stream');

          // Chỉ hiện loading spinner (1 ô) cho đến token đầu
          const response = await fetch(API_ENDPOINTS.RAG_STREAMING, {
            method: 'POST',
            headers: streamHeaders,
            body: JSON.stringify({
              userId: username || 'anonymous',
              text: questionText,
              source: chatbotConfig.source,
              save: true,
              mode: 'default',
              sessionId: activeSessionId,
              metadata: {
                subjectName: chatbotConfig.name || '',
              },
            }),
          });

          if (!response.ok) {
            throw new Error(`Stream HTTP ${response.status}`);
          }
          if (!response.body) {
            throw new Error('Stream body unavailable');
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            // Chuẩn hóa xuống dòng (proxy đôi khi dùng \r\n)
            buffer = buffer.replace(/\r\n/g, '\n');
            const parts = buffer.split('\n\n');
            buffer = parts.pop() || '';

            for (const part of parts) {
              const lines = part.split('\n');
              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith(':')) continue;
                if (!trimmed.startsWith('data:')) continue;
                const payload = trimmed.slice(5).trim();
                if (!payload || payload === '[DONE]') continue;

                let event;
                try {
                  event = JSON.parse(payload);
                } catch {
                  continue;
                }

                if (event.session_id) rememberSessionId(event.session_id);
                const stage = event.stage;
                if (stage === 'token' && event.content != null && event.content !== '') {
                  fullText += event.content;
                  gotFirstToken = true;
                  applyBotUpdate({ text: fullText, streaming: true });
                } else if (stage === 'sources' && Array.isArray(event.sources)) {
                  if (gotFirstToken) {
                    applyBotUpdate({ sources: formatSourceLabels(event.sources) });
                  }
                } else if (stage === 'complete') {
                  const finalText = event.response || fullText;
                  fullText = finalText || fullText;
                  if (fullText) {
                    applyBotUpdate({
                      text: fullText,
                      sources: formatSourceLabels(event.sources || []),
                      streaming: false,
                    });
                  }
                } else if (stage === 'error') {
                  throw new Error(event.message || 'Lỗi stream từ server');
                }
              }
            }
          }

          if (!fullText) {
            throw new Error('Stream rỗng');
          }
          applyBotUpdate({ streaming: false });
          if (fullText && isSpeakerActive) speakText(fullText);
        } catch (streamErr) {
          console.warn('Stream failed, fallback non-stream:', streamErr);
          if (gotFirstToken && fullText) {
            applyBotUpdate({ streaming: false });
          } else {
            // Vẫn đang loading spinner → fallback non-stream vào 1 bubble
            await finishWithNonStream();
          }
        }
      } catch (error) {
        console.error('Chat send error:', error);
        setMessages(prev => [...prev, {
          id: uuidv4(),
          text: `Không kết nối được máy chủ${error?.message ? ` (${error.message})` : ''}. Thử lại sau.`,
          sender: 'bot',
          timestamp: new Date().toLocaleTimeString(),
        }]);
      } finally {
        setIsLoading(false);
      }
    }
  }, [inputMessage, isLoading, chatbotConfig.id, chatbotConfig.name, chatbotConfig.source, username, sessionId, ensureSessionId, rememberSessionId, isSpeakerActive, speakText, setIsLoading, formatSourceLabels]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const toggleVoiceInput = useCallback(() => {
    if (isVoiceInputActive) {
      speechRecognition.current.stop();
    } else {
      speechRecognition.current.start();
    }
    setIsVoiceInputActive(!isVoiceInputActive);
  }, [isVoiceInputActive]);

  const handleToggleSpeaker = useCallback((messageText) => {
    if (!isSpeakerActive) {
      speakText(messageText);
    }
    toggleSpeaker();
  }, [isSpeakerActive, speakText, toggleSpeaker]);

  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
    if ("webkitSpeechRecognition" in window) {
      speechRecognition.current = new window.webkitSpeechRecognition();
      speechRecognition.current.continuous = true;
      speechRecognition.current.interimResults = true;
      speechRecognition.current.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0])
          .map(result => result.transcript)
          .join("");
        setInputMessage(transcript);
      };
      speechRecognition.current.onerror = (event) => {
        setIsVoiceInputActive(false);
      };
    }
    return () => {
      if (speechRecognition.current) {
        speechRecognition.current.stop();
      }
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (chatbotConfig && chatbotConfig.source && username) {
      loadChatHistory();
    }
  }, [chatbotConfig.source, username]);

  useEffect(() => {
    setChatHistory([]);
    setMessages([]);
  }, [chatbotConfig.source]);

  useEffect(() => {
    if (chatbotConfig.source) {
      ensureSessionId();
    }
  }, [chatbotConfig.source, ensureSessionId]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [inputMessage]);

  // Effect để thay đổi loading message theo thời gian
  useEffect(() => {
    let interval;
    if (isLoading) {
      interval = setInterval(() => {
        setLoadingMessageIndex(prev => (prev + 1) % loadingMessages.length);
      }, 2000); // Thay đổi message mỗi 2 giây
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading, loadingMessages.length]);

  return (
    <div className="flex flex-col h-full bg-gray-100 overflow-hidden">
      <style>{`
        @keyframes loadingProgress {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 100%; }
        }

        @keyframes fadeInOut {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        .katex-display {
          max-width: 100%;
        }

        .katex {
          font-size: 1em;
        }
      `}</style>
      <div ref={chatHistoryRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingHistory && (
          <div className="flex justify-center items-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-gray-600">Đang tải lịch sử chat...</span>
          </div>
        )}
        {!isLoadingHistory && messages.length === 0 && (
          <div className="flex justify-center items-center py-12 bg-gray-50">
            <div className="relative bg-white text-gray-700 rounded-xl shadow-sm p-6 text-center max-w-md transform transition-all hover:scale-102 duration-200">
              {/* Icon nhẹ nhàng */}
              <div className="text-4xl mb-3">🌟</div>

              {/* Tiêu đề thanh lịch */}
              <h1 className="font-semibold text-2xl mb-2 text-gray-800">
                Xin chào!
              </h1>

              {/* Mô tả tối giản */}
              <p className="text-sm text-gray-500 leading-relaxed">
                Tôi là trợ lý AI.
                Hỏi tôi bất cứ điều gì hoặc bắt đầu trò chuyện nhé!
              </p>

              {/* Nút đơn giản */}
              {/* <button className="mt-5 px-5 py-2 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors duration-200">
        Khám phá ngay
      </button> */}
            </div>
          </div>
        )}
        {messages.map((message) => (
          <ChatMessageRow key={message.id} message={message} />
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-xs lg:max-w-md xl:max-w-lg bg-white text-gray-800 rounded-lg p-4 rounded-bl-none shadow-md border-l-4 border-blue-400">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl animate-pulse">{loadingMessages[loadingMessageIndex].emoji}</span>
                    <span className="text-sm font-medium text-gray-700 animate-pulse">
                      {loadingMessages[loadingMessageIndex].text}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    <span className="animate-pulse">{loadingMessages[loadingMessageIndex].subtitle}</span>
                  </div>
                </div>
              </div>

              {/* Progress bar animation */}
              <div className="mt-3 w-full bg-gray-200 rounded-full h-1">
                <div className="bg-blue-500 h-1 rounded-full animate-pulse" style={{
                  width: '0%',
                  animation: 'loadingProgress 3s ease-in-out infinite'
                }}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex items-center space-x-2">
          <textarea
            ref={textareaRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Nhập tin nhắn của bạn…"
            className="flex-1 border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-y-auto"
            rows="1"
            style={{ minHeight: '40px', maxHeight: '160px' }}
          />
          <button
            onClick={handleOpenQuiz}
            disabled={isLoadingChapters}
            className="bg-green-500 text-white p-2 rounded-full hover:bg-green-600 focus:outline-none flex items-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <FaQuestionCircle className="w-5 h-5" />
            <span>{isLoadingChapters ? "Đang tải..." : "Luyện tập"}</span>
          </button>
          <button
            onClick={clearChatHistory}
            className="p-2 rounded-full bg-gray-200 text-gray-600 hover:bg-red-100 hover:text-red-600 focus:outline-none transition-colors duration-200"
            title="Xóa lịch sử chat"
          >
            <FaTrash className="w-4 h-4" />
          </button>
          {/* <button
            onClick={toggleVoiceInput}
            className={`p-2 rounded-full ${isVoiceInputActive ? "bg-red-500 text-white" : "bg-gray-200 text-gray-600"} hover:bg-opacity-80 focus:outline-none`}
          >
            <FaMicrophone className="w-4 h-4" />
          </button> */}
          <button
            onClick={handleSendMessage}
            className="bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600 focus:outline-none"
          >
            <FaPaperPlane className="w-5 h-5" />
          </button>
        </div>
      </div>

      {isQuizOpen && (
        <QuizPopup
          isOpen={isQuizOpen}
          onClose={() => setIsQuizOpen(false)}
          apiUrl={apiUrl}
          orderedPracticeScope={orderedPracticeScope}
          answerDisplayMode={answerDisplayMode}
          onExplanationRequest={handleExplanationRequest}
        />
      )}

      {showChapterSelector && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/55 p-3 sm:p-6">
          <div className="mx-auto my-2 w-full max-w-[1440px] overflow-hidden rounded-xl bg-white shadow-2xl sm:my-4">
            <header className="relative border-b border-gray-200 bg-white px-6 py-5 pr-16 text-gray-900 sm:px-8 sm:py-6 sm:pr-20">
              <button
                type="button"
                onClick={() => setShowChapterSelector(false)}
                aria-label="Đóng thiết lập luyện tập"
                title="Đóng"
                className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 sm:right-6 sm:top-5"
              >
                <X size={21} aria-hidden="true" />
              </button>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#b42318]">Phòng luyện tập</p>
              <h2 className="mt-1 max-w-4xl text-xl font-bold sm:text-2xl">
                Đề trắc nghiệm {chatbotConfig.name || chatbotConfig.quizTopic || "Tổng hợp"}
              </h2>
              <p className="mt-2 text-sm text-gray-600">Chọn chương và phạm vi câu hỏi muốn luyện tập.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedChapter && <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">{selectedChapter.count} câu hỏi trong {selectedChapter.label}</span>}
                {!selectedChapter && availableQuestionCount > 0 && <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">{availableQuestionCount} câu hỏi · toàn môn</span>}
                {chatbotConfig.quizTopic && <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">{chatbotConfig.quizTopic}</span>}
              </div>
            </header>

            <div className="space-y-0 px-5 sm:px-8">
              <section className="flex flex-col gap-3 border-b border-gray-200 py-5 sm:flex-row sm:items-center sm:justify-between">
                <label htmlFor="practice-chapter" className="text-base font-medium text-gray-800">Chọn chương</label>
                <select
                  id="practice-chapter"
                  value={selectedChapters[0] || ""}
                  onChange={(event) => {
                    const chapter = availableChapters.find((item) => item.value === event.target.value);
                    setSelectedChapters(chapter ? [chapter.value] : []);
                    setQuizRangeStart(1);
                    setQuizQuestionCount(Math.min(50, chapter?.count || 10));
                  }}
                  disabled={!availableChapters.length}
                  className="min-h-12 w-full rounded-lg border border-[#c91f16] bg-white px-3 text-base text-gray-900 outline-none focus:ring-2 focus:ring-red-200 sm:max-w-[min(100%,520px)]"
                >
                  {availableChapters.length
                    ? availableChapters.map((chapter) => <option key={chapter.value} value={chapter.value}>{chapter.label} · {chapter.count} câu</option>)
                    : <option value="">Toàn bộ ngân hàng câu hỏi</option>}
                </select>
              </section>

              <section className="border-b border-gray-200 py-5">
                <h3 className="text-sm font-semibold uppercase tracking-[0.06em] text-gray-500">Chọn bộ câu hỏi</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {questionRangeOptions.map((range) => (
                    <button
                      key={range.start}
                      type="button"
                      aria-pressed={quizSelectionMode === "ordered" && quizRangeStart === range.start}
                      onClick={() => {
                        setQuizRangeStart(range.start);
                        setQuizSelectionMode("ordered");
                      }}
                      className={`min-h-11 rounded-full border px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 ${quizSelectionMode === "ordered" && quizRangeStart === range.start ? "border-[#c91f16] bg-[#c91f16] text-white" : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"}`}
                    >
                      Câu {range.start}–{range.end}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-pressed={quizSelectionMode === "random"}
                    onClick={() => setQuizSelectionMode("random")}
                    className={`min-h-11 rounded-full border px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 ${quizSelectionMode === "random" ? "border-[#c91f16] bg-[#c91f16] text-white" : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"}`}
                  >Random câu hỏi</button>
                  {!selectedChapter && availableQuestionCount === 0 && <span className="text-sm text-gray-500">Chọn chương để xem các khoảng câu hỏi.</span>}
                </div>
                {selectedQuestionTotal > 0 && <div className="mt-4 flex items-start gap-3 rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-900">
                  <Info size={19} className="mt-0.5 shrink-0 text-sky-600" aria-hidden="true" />
                  <p>{selectedChapter ? <>{selectedChapter.label} có tổng <strong className="text-sky-700">{selectedChapter.count}</strong> câu hỏi.</> : <>Môn này chưa chia chương, ngân hàng có <strong className="text-sky-700">{availableQuestionCount}</strong> câu hỏi.</>} Chia thành các bộ tối đa <strong className="text-sky-700">{effectiveQuestionBatchSize}</strong> câu; bộ cuối có thể ít hơn.</p>
                </div>}
              </section>

              <section className="border-b border-gray-200 py-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-medium text-gray-800">Chọn số lượng câu hỏi</h3>
                    <p className="mt-1 text-sm text-gray-500">Tối đa {maxQuestionCount} câu trong {selectedChapter ? selectedChapter.label : "toàn môn"}; số câu này quyết định kích thước mỗi bộ</p>
                  </div>
                  <div className={`inline-flex min-h-14 items-center self-start rounded-lg border bg-white p-1 shadow-sm sm:self-auto ${questionCountError && quizQuestionCount !== "" ? "border-red-400" : "border-gray-200"}`}>
                    <button
                      type="button"
                      aria-label="Giảm số câu hỏi"
                      title="Giảm 1 câu"
                      disabled={quizQuestionCount <= 1}
                      onClick={() => setQuizQuestionCount((count) => Math.max(1, count - 1))}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                    ><Minus size={18} aria-hidden="true" /></button>
                    <div className="flex min-w-24 flex-col items-center px-2" aria-live="polite">
                      <input
                        id="practice-question-count"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max={maxQuestionCount}
                        step="1"
                        value={quizQuestionCount}
                        aria-label={`Số câu hỏi, tối đa ${maxQuestionCount}`}
                        onChange={(event) => {
                          const rawValue = event.target.value;
                          if (rawValue === "") {
                            updateQuestionCount("");
                            return;
                          }
                          const value = Number(rawValue);
                          if (Number.isFinite(value)) {
                            updateQuestionCount(value);
                          }
                        }}
                        onBlur={() => {
                          if (quizQuestionCount === "") setQuizQuestionCount(1);
                        }}
                        aria-invalid={Boolean(questionCountError)}
                        aria-describedby={questionCountError ? "practice-question-count-error" : undefined}
                        className="w-16 border-0 bg-transparent p-0 text-center text-xl font-bold leading-6 text-gray-900 outline-none focus:ring-0"
                      />
                      <span className="text-xs text-gray-500">câu hỏi</span>
                    </div>
                    <button
                      type="button"
                      aria-label="Tăng số câu hỏi"
                      title="Tăng 1 câu"
                      disabled={quizQuestionCount >= maxQuestionCount}
                      onClick={() => setQuizQuestionCount((count) => Math.min(maxQuestionCount, count + 1))}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                    ><Plus size={18} aria-hidden="true" /></button>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Chọn nhanh số câu hỏi">
                  {questionCountPresets.map((count) => (
                    <button
                      key={count}
                      type="button"
                      aria-pressed={quizQuestionCount === count}
                      onClick={() => updateQuestionCount(count)}
                      className={`min-h-10 min-w-14 rounded-md border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 ${quizQuestionCount === count ? "border-[#c91f16] bg-red-50 text-[#a91b14]" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}
                    >{count}</button>
                  ))}
                </div>
                {questionCountError && <p id="practice-question-count-error" role="alert" className="mt-3 text-sm font-medium text-red-700">{questionCountError}</p>}
              </section>

              <section className="flex flex-col gap-3 border-b border-gray-200 py-5 sm:flex-row sm:items-center sm:justify-between">
                <label htmlFor="answer-display-mode" className="text-base font-medium text-gray-800">Kiểu hiển thị</label>
                <select id="answer-display-mode" value={answerDisplayMode} onChange={(event) => setAnswerDisplayMode(event.target.value)} className="min-h-12 w-full rounded-lg border border-[#c91f16] bg-white px-3 text-base text-gray-900 outline-none focus:ring-2 focus:ring-red-200 sm:w-[310px]">
                  <option value="sequential">Trả lời tuần tự từng câu hỏi</option>
                  <option value="all">Hiển thị tất cả câu hỏi</option>
                </select>
              </section>

              <footer className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-start gap-3 rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-900">
                  <Info size={19} className="mt-0.5 shrink-0 text-sky-600" aria-hidden="true" />
                  <p>
                    {quizSelectionMode === "random" ? <>Hệ thống sẽ lấy ngẫu nhiên <strong className="text-sky-700">{Number.isFinite(enteredQuestionCount) ? enteredQuestionCount : 0}</strong> câu{selectedChapter ? <> trong <strong className="text-sky-700">{selectedChapter.label}</strong>.</> : " trong toàn môn."}</> : <>Hệ thống sẽ lấy <strong className="text-sky-700">{Math.min(Number.isFinite(enteredQuestionCount) ? enteredQuestionCount : 0, selectedRangeCount)}</strong> câu{selectedChapter ? <> trong <strong className="text-sky-700">{selectedChapter.label}</strong></> : null}{selectedQuestionTotal > 0 ? <> theo bộ <strong className="text-sky-700">Câu {quizRangeStart}–{selectedRangeEnd}</strong>{selectedChapter ? "." : " của toàn môn."}</> : " trong ngân hàng câu hỏi."}</>}
                  </p>
                </div>
                <div className="flex shrink-0 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setQuizRangeStart(1);
                      setQuizQuestionCount(Math.min(50, selectedChapter?.count || availableQuestionCount || 10));
                      setQuizSelectionMode("ordered");
                      setAnswerDisplayMode("sequential");
                    }}
                    className="min-h-12 rounded-lg bg-gray-100 px-5 text-sm font-semibold text-gray-800 hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                  >Đặt lại</button>
                  <button
                    type="button"
                    onClick={handleStartQuizWithSelectedChapters}
                    disabled={Boolean((availableChapters.length && !selectedChapter) || questionCountError)}
                    className="min-h-12 rounded-lg bg-[#c91f16] px-6 text-sm font-semibold text-white hover:bg-[#a91b14] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                  >Bắt đầu luyện tập</button>
                </div>
              </footer>
            </div>
          </div>
        </div>
      )}

      {/* Modal xác nhận xóa lịch sử */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 mx-4 max-w-sm w-full shadow-xl">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
              <FaTrash className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 text-center mb-2">
              Xóa lịch sử chat
            </h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              Bạn có chắc chắn muốn xóa toàn bộ lịch sử chat không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={confirmClearHistory}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {showToast && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ease-in-out">
          <div className={`px-6 py-3 bg-white shadow-xl rounded-full border ${toastType === "success"
            ? "border-green-200 bg-gradient-to-r from-green-50 to-white"
            : "border-red-200 bg-gradient-to-r from-red-50 to-white"
            } flex items-center space-x-3 min-w-fit`}>
            <div className={`flex items-center justify-center w-6 h-6 rounded-full ${toastType === "success" ? "bg-green-500" : "bg-red-500"
              }`}>
              {toastType === "success" ? (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>

            <span className="text-sm font-medium text-gray-800 whitespace-nowrap">
              {toastMessage}
            </span>

            <button
              onClick={() => setShowToast(false)}
              className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors duration-200 ml-2"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(UnifiedChatbot); 
