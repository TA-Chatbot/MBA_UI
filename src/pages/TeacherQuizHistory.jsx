import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import { API_ENDPOINTS } from '../config/api';
import {
    FaHistory,
    FaFilter,
    FaSearch,
    FaChartBar,
    FaUserGraduate,
    FaStar,
    FaCalendar,
    FaArrowLeft,
    FaRedo,
    FaChevronLeft,
    FaChevronRight,
    FaChartPie
} from 'react-icons/fa';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const TeacherQuizHistory = () => {
    const [submissions, setSubmissions] = useState([]);
    const [statistics, setStatistics] = useState({
        total_submissions: 0,
        average_score: 0,
        unique_students: 0
    });
    const [scoreDistribution, setScoreDistribution] = useState([]);
    const [hoveredScore, setHoveredScore] = useState(null);
    const [lockedScore, setLockedScore] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Filter states
    const [selectedTopic, setSelectedTopic] = useState('');
    const [searchUsername, setSearchUsername] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [assignedTopics, setAssignedTopics] = useState([]);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(20);
    const [totalItems, setTotalItems] = useState(0);

    // Detail modal
    const [selectedSubmission, setSelectedSubmission] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    const navigate = useNavigate();

    const colors = {
        primary: '#dc2626',
        secondary: '#ff416c',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444'
    };

    // Check teacher/admin role
    useEffect(() => {
        const userRole = localStorage.getItem('user_role');
        if (userRole !== 'teacher' && userRole !== 'admin') {
            navigate('/mini/');
            return;
        }
        fetchAssignedTopics();
    }, [navigate]);

    const getAuthHeaders = () => {
        const token = localStorage.getItem('access_token');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    };

    const fetchAssignedTopics = async () => {
        try {
            // Fetch teacher's assigned topics
            const teacherResponse = await fetch(API_ENDPOINTS.TEACHER_MY_TOPICS, {
                headers: getAuthHeaders()
            });

            if (!teacherResponse.ok) {
                throw new Error('Không thể tải danh sách môn học');
            }

            const teacherData = await teacherResponse.json();
            const topics = teacherData.assigned_topics || [];

            // Fetch all chatbots to get subject names
            const accessToken = localStorage.getItem('access_token');
            const chatbotsResponse = await fetch(API_ENDPOINTS.CHATBOTS,
                {
                    method: 'GET',
                    headers: {
                        'accept': 'application/json',
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`
                    }
                }
            );

            if (chatbotsResponse.ok) {
                const chatbotsData = await chatbotsResponse.json();
                const allChatbots = chatbotsData.chatbots || [];

                // Map assigned topics to include subject names
                const enrichedTopics = topics.map(topicCode => {
                    const chatbot = allChatbots.find(cb => cb.source === topicCode);
                    return {
                        code: topicCode,
                        name: chatbot ? chatbot.name : topicCode
                    };
                });

                setAssignedTopics(enrichedTopics);
            } else {
                // Fallback: just use topic codes
                setAssignedTopics(topics.map(code => ({ code, name: code })));
            }
        } catch (err) {
            console.error('Error fetching topics:', err);
            setAssignedTopics([]);
        }
    };

    const fetchQuizHistory = async (page = currentPage, filterOverrides = {}) => {
        try {
            setLoading(true);
            setError('');

            const topicFilter = filterOverrides.topic ?? selectedTopic;
            const usernameFilter = filterOverrides.username ?? searchUsername;
            const fromDateFilter = filterOverrides.fromDate ?? fromDate;
            const toDateFilter = filterOverrides.toDate ?? toDate;

            // Build query params
            const params = new URLSearchParams({
                skip: ((page - 1) * itemsPerPage).toString(),
                limit: itemsPerPage.toString(),
                sort_by: 'timestamp',
                sort_order: 'desc'
            });

            if (topicFilter) {
                params.append('topic', topicFilter);
            }

            if (usernameFilter.trim()) {
                params.append('username', usernameFilter.trim());
            }

            if (fromDateFilter) {
                params.append('from_date', fromDateFilter);
            }

            if (toDateFilter) {
                params.append('to_date', toDateFilter);
            }

            const response = await fetch(
                `${API_ENDPOINTS.TEACHER_QUIZ_HISTORY}?${params.toString()}`,
                {
                    headers: getAuthHeaders()
                }
            );

            if (!response.ok) {
                throw new Error('Không thể tải lịch sử làm bài');
            }

            const data = await response.json();
            const submissions = data.submissions || [];
            setSubmissions(submissions);
            setStatistics(data.statistics || {
                total_submissions: 0,
                average_score: 0,
                unique_students: 0
            });
            setTotalItems(data.total || 0);

            // Calculate score distribution
            calculateScoreDistribution(submissions);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Calculate score distribution for pie chart
    const calculateScoreDistribution = (submissions) => {
        if (!Array.isArray(submissions) || submissions.length === 0) {
            setScoreDistribution([]);
            return;
        }

        // Group submissions by score and collect student info
        const scoreGroups = {};
        submissions.forEach((submission) => {
            const score = submission.score || 0;
            if (!scoreGroups[score]) {
                scoreGroups[score] = {
                    score: score,
                    count: 0,
                    students: []
                };
            }
            scoreGroups[score].count++;
            scoreGroups[score].students.push({
                username: submission.username,
                fullName: submission.full_name || submission.username,
                date: submission.timestamp,
                correctAnswers: submission.correct_answers,
                totalQuestions: submission.total_questions
            });
        });

        // Convert to array and calculate percentages
        const distribution = Object.values(scoreGroups).map(group => ({
            name: `${group.score} điểm`,
            value: group.count,
            score: group.score,
            percentage: ((group.count / submissions.length) * 100).toFixed(1),
            students: group.students
        }));

        // Sort by score ascending (low to high)
        distribution.sort((a, b) => a.score - b.score);

        setScoreDistribution(distribution);
    };

    useEffect(() => {
        if (assignedTopics.length > 0) {
            fetchQuizHistory();
        }
    }, [currentPage, assignedTopics]);

    // Auto-fetch when topic filter changes
    useEffect(() => {
        if (assignedTopics.length > 0) {
            setCurrentPage(1); // Reset to page 1
            fetchQuizHistory();
        }
    }, [selectedTopic]);

    const handleFilter = () => {
        if (fromDate && toDate && fromDate > toDate) {
            setError('Ngày bắt đầu không được sau ngày kết thúc');
            return;
        }
        setCurrentPage(1);
        fetchQuizHistory(1);
    };

    const handleReset = () => {
        setSelectedTopic('');
        setSearchUsername('');
        setFromDate('');
        setToDate('');
        setCurrentPage(1);
        fetchQuizHistory(1, { topic: '', username: '', fromDate: '', toDate: '' });
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        const date = new Date(timestamp);
        return date.toLocaleString('vi-VN');
    };

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    const clearMessages = () => {
        setError('');
        setSuccess('');
    };

    const handleViewDetail = (submission) => {
        setSelectedSubmission(submission);
        setShowDetailModal(true);
    };

    const closeDetailModal = () => {
        setShowDetailModal(false);
        setSelectedSubmission(null);
    };

    return (
        <div className="bg-gradient-to-br from-red-100 to-pink-100" style={{ paddingTop: '100px' }}>
            <Navbar />

            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                            <button
                                onClick={() => navigate('/teacher')}
                                className="mr-4 text-gray-600 hover:text-gray-800"
                            >
                                <FaArrowLeft className="w-6 h-6" />
                            </button>
                            <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                                <FaHistory className="w-8 h-8 inline-block align-middle mr-3" style={{ color: colors.primary }} />
                                Lịch Sử Làm Bài Quiz
                            </h1>
                        </div>
                    </div>
                    <p className="text-gray-600">
                        Xem và theo dõi lịch sử làm bài quiz của học sinh theo môn học
                    </p>
                </div>

                {/* Error/Success Messages */}
                {error && (
                    <div className="p-4 rounded-lg mb-6 bg-red-100 border border-red-400 text-red-700">
                        <div className="flex justify-between items-center">
                            <p>{error}</p>
                            <button onClick={clearMessages} className="text-xl font-bold">×</button>
                        </div>
                    </div>
                )}

                {success && (
                    <div className="p-4 rounded-lg mb-6 bg-green-100 border border-green-400 text-green-700">
                        <div className="flex justify-between items-center">
                            <p>{success}</p>
                            <button onClick={clearMessages} className="text-xl font-bold">×</button>
                        </div>
                    </div>
                )}

                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex items-center">
                            <div className="p-3 rounded-full bg-blue-100 mr-4">
                                <FaChartBar className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-600">Tổng Số Bài Làm</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {statistics.total_submissions}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex items-center">
                            <div className="p-3 rounded-full bg-green-100 mr-4">
                                <FaStar className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-600">Điểm Trung Bình</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {statistics.average_score.toFixed(1)}%
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex items-center">
                            <div className="p-3 rounded-full bg-purple-100 mr-4">
                                <FaUserGraduate className="w-6 h-6 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-600">Số Học Sinh</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {statistics.unique_students}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                        <FaFilter className="w-4 h-4 inline-block align-middle mr-2" />
                        Bộ Lọc
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Môn Học
                            </label>
                            <select
                                value={selectedTopic}
                                onChange={(e) => setSelectedTopic(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                            >
                                <option value="">-- Tất cả môn học --</option>
                                {assignedTopics.map((topic, index) => (
                                    <option key={index} value={topic.code}>
                                        {topic.name} ({topic.code})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Từ Ngày
                            </label>
                            <input
                                type="date"
                                value={fromDate}
                                max={toDate || undefined}
                                onChange={(e) => setFromDate(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Đến Ngày
                            </label>
                            <input
                                type="date"
                                value={toDate}
                                min={fromDate || undefined}
                                onChange={(e) => setToDate(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Tìm Theo Username
                            </label>
                            <input
                                type="text"
                                value={searchUsername}
                                onChange={(e) => setSearchUsername(e.target.value)}
                                placeholder="Nhập username học sinh"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                        </div>

                        <div className="flex items-end space-x-2">
                            <button
                                onClick={handleFilter}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center justify-center"
                            >
                                <FaFilter className="w-4 h-4 inline-block align-middle mr-2" />
                                Lọc
                            </button>
                            <button
                                onClick={handleReset}
                                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors flex items-center justify-center"
                            >
                                <FaRedo className="w-4 h-4 inline-block align-middle mr-2" />
                                Reset
                            </button>
                        </div>
                    </div>
                </div>

                {/* Score Distribution Chart */}
                {scoreDistribution.length > 0 && (
                    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                            <FaChartPie className="mr-2 text-red-600" />
                            Phân Bố Điểm Số
                        </h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Left: Information Panel */}
                            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                                {(lockedScore || hoveredScore) ? (
                                    <div>
                                        <div className="mb-4">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-2xl font-bold text-gray-900 mb-2">{(lockedScore || hoveredScore).name}</h4>
                                                {lockedScore && (
                                                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full font-medium">
                                                        Đã khóa
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-lg text-gray-600">
                                                <strong>{(lockedScore || hoveredScore).value}</strong> học sinh ({(lockedScore || hoveredScore).percentage}%)
                                            </p>
                                        </div>
                                        <div className="border-t border-gray-300 pt-4">
                                            <p className="text-sm font-semibold text-gray-700 mb-3">Học sinh đạt điểm này:</p>
                                            <div className="max-h-64 overflow-y-auto space-y-3">
                                                {(lockedScore || hoveredScore).students.map((student, idx) => (
                                                    <div key={idx} className="bg-white rounded-lg p-3 border border-gray-200">
                                                        <div className="font-medium text-gray-900">{student.fullName}</div>
                                                        <div className="text-sm text-gray-600 mt-1">
                                                            @{student.username}
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            {new Date(student.date).toLocaleDateString('vi-VN', {
                                                                year: 'numeric',
                                                                month: 'long',
                                                                day: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </div>
                                                        <div className="text-sm text-gray-600 mt-1">
                                                            <span className="font-medium">{student.correctAnswers}/{student.totalQuestions}</span> câu đúng
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-center">
                                        <div>
                                            <FaChartPie className="text-6xl text-gray-300 mx-auto mb-4" />
                                            <p className="text-gray-500">Di chuột qua biểu đồ để xem chi tiết</p>
                                            <p className="text-sm text-gray-400 mt-2">Nhấp vào phân đoạn để khóa</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right: Pie Chart */}
                            <div className="h-96" onClick={() => setLockedScore(null)}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={scoreDistribution}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percentage }) => `${name}: ${percentage}%`}
                                            outerRadius={120}
                                            fill="#8884d8"
                                            dataKey="value"
                                            onMouseEnter={(data) => {
                                                if (!lockedScore) {
                                                    setHoveredScore(data);
                                                }
                                            }}
                                            onMouseLeave={() => {
                                                if (!lockedScore) {
                                                    setHoveredScore(null);
                                                }
                                            }}
                                            onClick={(data, index, e) => {
                                                e.stopPropagation();
                                                setLockedScore(lockedScore?.score === data.score ? null : data);
                                                setHoveredScore(null);
                                            }}
                                        >
                                            {scoreDistribution.map((entry, index) => {
                                                const colors = ['#dc2626', '#ea580c', '#ca8a04', '#65a30d', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#c026d3', '#db2777'];
                                                const activeScore = lockedScore || hoveredScore;
                                                return <Cell
                                                    key={`cell-${index}`}
                                                    fill={colors[index % colors.length]}
                                                    opacity={activeScore && activeScore.score === entry.score ? 1 : activeScore ? 0.3 : 1}
                                                    style={{ cursor: 'pointer' }}
                                                />;
                                            })}
                                        </Pie>
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}

                {/* Results Table */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-800">
                            Kết Quả ({totalItems} bài làm)
                        </h3>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center p-12">
                            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-600"></div>
                        </div>
                    ) : submissions.length > 0 ? (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                STT
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Username
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Tên Học Sinh
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Điểm (%)
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Số Câu Đúng
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Thời Gian
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {submissions.map((submission, index) => (
                                            <tr
                                                key={submission._id}
                                                className="hover:bg-gray-50 cursor-pointer transition-colors"
                                                onClick={() => handleViewDetail(submission)}
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {(currentPage - 1) * itemsPerPage + index + 1}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {submission.username}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                    {submission.student_name || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <span
                                                        className={`px-2 py-1 rounded-full font-semibold ${submission.score >= 80
                                                            ? 'bg-green-100 text-green-800'
                                                            : submission.score >= 60
                                                                ? 'bg-yellow-100 text-yellow-800'
                                                                : 'bg-red-100 text-red-800'
                                                            }`}
                                                    >
                                                        {submission.score.toFixed(1)}%
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {submission.correct_answers}/{submission.total_questions}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                    <div className="flex items-center">
                                                        <FaCalendar className="w-4 h-4 inline-block align-middle mr-2 text-gray-400" />
                                                        {formatDate(submission.timestamp)}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm text-gray-700">
                                            Trang {currentPage} / {totalPages}
                                        </div>
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                                disabled={currentPage === 1}
                                                className={`px-4 py-2 rounded-md flex items-center ${currentPage === 1
                                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                                    }`}
                                            >
                                                <FaChevronLeft className="w-4 h-4 inline-block align-middle mr-2" />
                                                Trước
                                            </button>
                                            <button
                                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                                disabled={currentPage === totalPages}
                                                className={`px-4 py-2 rounded-md flex items-center ${currentPage === totalPages
                                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                                    }`}
                                            >
                                                Sau
                                                <FaChevronRight className="w-4 h-4 inline-block align-middle ml-2" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                            <FaHistory className="w-24 h-24 mx-auto mb-4 text-gray-300" />
                            <h3 className="text-xl font-medium mb-2">Không có dữ liệu</h3>
                            <p className="text-gray-400">
                                {selectedTopic || searchUsername || fromDate || toDate
                                    ? 'Không tìm thấy kết quả với bộ lọc hiện tại'
                                    : 'Chưa có học sinh nào làm bài quiz'}
                            </p>
                        </div>
                    )}
                </div>

                {/* Detail Modal */}
                {showDetailModal && selectedSubmission && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                            {/* Modal Header */}
                            <div className="bg-gradient-to-r from-red-600 to-pink-600 text-white px-6 py-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-2xl font-bold">Chi Tiết Bài Làm</h2>
                                        <p className="text-sm text-red-100 mt-1">
                                            {selectedSubmission.student_name} ({selectedSubmission.username})
                                        </p>
                                    </div>
                                    <button
                                        onClick={closeDetailModal}
                                        className="text-white hover:text-red-200 text-3xl font-bold"
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>

                            {/* Modal Content */}
                            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                                {/* Summary Stats */}
                                <div className="grid grid-cols-3 gap-4 mb-6">
                                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                                        <p className="text-sm text-blue-600 font-medium">Tổng Số Câu</p>
                                        <p className="text-2xl font-bold text-blue-900">
                                            {selectedSubmission.total_questions}
                                        </p>
                                    </div>
                                    <div className="bg-green-50 rounded-lg p-4 text-center">
                                        <p className="text-sm text-green-600 font-medium">Số Câu Đúng</p>
                                        <p className="text-2xl font-bold text-green-900">
                                            {selectedSubmission.correct_answers}
                                        </p>
                                    </div>
                                    <div className={`rounded-lg p-4 text-center ${selectedSubmission.score >= 80 ? 'bg-green-50' :
                                        selectedSubmission.score >= 60 ? 'bg-yellow-50' : 'bg-red-50'
                                        }`}>
                                        <p className={`text-sm font-medium ${selectedSubmission.score >= 80 ? 'text-green-600' :
                                            selectedSubmission.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                                            }`}>Điểm Số</p>
                                        <p className={`text-2xl font-bold ${selectedSubmission.score >= 80 ? 'text-green-900' :
                                            selectedSubmission.score >= 60 ? 'text-yellow-900' : 'text-red-900'
                                            }`}>
                                            {selectedSubmission.score.toFixed(1)}%
                                        </p>
                                    </div>
                                </div>

                                {/* Questions List */}
                                <div className="space-y-4">
                                    {selectedSubmission.questions && selectedSubmission.questions.map((q, idx) => (
                                        <div
                                            key={idx}
                                            className={`border-2 rounded-lg p-4 ${q.is_correct
                                                ? 'border-green-200 bg-green-50'
                                                : 'border-red-200 bg-red-50'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <h3 className="font-semibold text-gray-900">
                                                    Câu {idx + 1}: {q.question}
                                                </h3>
                                                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${q.is_correct
                                                    ? 'bg-green-200 text-green-800'
                                                    : 'bg-red-200 text-red-800'
                                                    }`}>
                                                    {q.is_correct ? '✓ Đúng' : '✗ Sai'}
                                                </span>
                                            </div>

                                            <div className="space-y-2">
                                                <div className={`p-3 rounded-md ${q.is_correct ? 'bg-green-100' : 'bg-yellow-100'
                                                    }`}>
                                                    <p className="text-sm font-medium text-gray-700">
                                                        Câu trả lời của học sinh:
                                                    </p>
                                                    <p className="font-semibold text-gray-900">{q.user_answer}</p>
                                                </div>

                                                {!q.is_correct && (
                                                    <div className="p-3 rounded-md bg-green-100">
                                                        <p className="text-sm font-medium text-gray-700">
                                                            Đáp án đúng:
                                                        </p>
                                                        <p className="font-semibold text-green-900">{q.correct_answer}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                                <div className="flex justify-between items-center">
                                    <p className="text-sm text-gray-600 flex items-center">
                                        <FaCalendar className="w-4 h-4 inline-block align-middle mr-2" />
                                        Thời gian làm bài: {formatDate(selectedSubmission.timestamp)}
                                    </p>
                                    <button
                                        onClick={closeDetailModal}
                                        className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                                    >
                                        Đóng
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <Footer />
        </div>
    );
};

export default TeacherQuizHistory;
