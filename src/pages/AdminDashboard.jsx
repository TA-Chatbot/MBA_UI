import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import { API_ENDPOINTS } from '../config/api';
import {
  FaRobot,
  FaPlus,
  FaEdit,
  FaTrash,
  FaSave,
  FaTimes,
  FaExclamationTriangle,
  FaSpinner,
  FaSearch,
  FaTachometerAlt
} from 'react-icons/fa';

const AdminDashboard = () => {
  const [chatbots, setChatbots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create', 'edit', 'delete'
  const [selectedChatbot, setSelectedChatbot] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    source: '',
    prompt: ''
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // States for avatar upload
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  
  // No more upload tab - only chatbot management
  
  const navigate = useNavigate();

  const colors = {
    primary: '#dc2626',
    secondary: '#ff416c',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444'
  };

  // Kiểm tra quyền admin
  useEffect(() => {
    const userRole = localStorage.getItem('user_role');
    if (userRole !== 'admin') {
      navigate('/mini/');
      return;
    }
    fetchChatbots();
  }, [navigate]);


  const fetchChatbots = async () => {
    try {
      setLoading(true);
      const accessToken = localStorage.getItem('access_token');
      const response = await fetch(API_ENDPOINTS.CHATBOTS,
        {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
      if (!response.ok) {
        throw new Error(await getApiError(response, 'Không thể tải danh sách chatbot'));
      }
      const data = (await parseJsonSafe(response)) || {};
      const chatbotList = data.chatbots || [];
      setChatbots(chatbotList);
    } catch (err) {
      setError('Không thể tải danh sách chatbot');
    } finally {
      setLoading(false);
    }
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  // Function để tạo source và quiztopic từ tên chatbot
  const generateSourceAndQuizTopic = (name) => {
    // Bỏ dấu tiếng Việt
    const removeAccents = (str) => {
      return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
    };
    
    // Tạo chuỗi base từ tên
    const baseString = removeAccents(name)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 15); // Giới hạn độ dài
    
    // Tạo 5 số ngẫu nhiên
    const randomNumbers = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    
    return baseString + randomNumbers;
  };

  // Chuẩn hóa mã môn: bỏ dấu và ký tự đặc biệt, giữ nguyên chữ hoa/thường
  const normalizeTopicCode = (value) =>
    (value || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^A-Za-z0-9_-]/g, '');

  const handleCreateChatbot = async () => {
    try {
      if (!avatarFile) {
        setError('Vui lòng chọn ảnh avatar');
        return;
      }

      // Mã môn do admin nhập; nếu bỏ trống thì tự sinh từ tên chatbot
      const topicCode = normalizeTopicCode(formData.source) || generateSourceAndQuizTopic(formData.name);
      if (topicCode.length < 3) {
        setError('Mã môn phải có ít nhất 3 ký tự (chữ cái không dấu, số, "-" hoặc "_").');
        return;
      }
      if (chatbots.some((c) => (c.source || '').toLowerCase() === topicCode.toLowerCase())) {
        setError(`Mã môn "${topicCode}" đã tồn tại. Vui lòng chọn mã khác.`);
        return;
      }

      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('source', topicCode);
      formDataToSend.append('quizTopic', topicCode);
      formDataToSend.append('prompt', formData.prompt);
      formDataToSend.append('avatar_file', avatarFile);

      const token = localStorage.getItem('access_token');
      const response = await fetch(API_ENDPOINTS.ADMIN_CHATBOTS, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataToSend
      });

      if (!response.ok) {
        const errorData = (await parseJsonSafe(response)) || {};
        throw new Error(errorData.detail || 'Không thể tạo chatbot');
      }

      setSuccess('Chatbot đã được tạo thành công!');
      fetchChatbots();
      closeModal();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateChatbot = async () => {
    try {
      // Endpoint PUT chỉ nhận JSON (ChatbotUpdate), avatar gửi dưới dạng base64
      const updateData = {};

      if (formData.name && formData.name !== selectedChatbot.name) {
        updateData.name = formData.name;
      }
      if (formData.prompt && formData.prompt !== selectedChatbot.prompt) {
        updateData.prompt = formData.prompt;
      }

      const topicCode = normalizeTopicCode(formData.source);
      if (topicCode && topicCode !== selectedChatbot.source) {
        if (topicCode.length < 3) {
          setError('Mã môn phải có ít nhất 3 ký tự (chữ cái không dấu, số, "-" hoặc "_").');
          return;
        }
        if (chatbots.some((c) => c.id !== selectedChatbot.id && (c.source || '').toLowerCase() === topicCode.toLowerCase())) {
          setError(`Mã môn "${topicCode}" đã tồn tại. Vui lòng chọn mã khác.`);
          return;
        }
        updateData.source = topicCode;
        updateData.quizTopic = topicCode;
      }

      if (avatarFile && avatarPreview) {
        updateData.avatar = avatarPreview;
      }

      if (Object.keys(updateData).length === 0) {
        setError('Không có thay đổi nào để cập nhật');
        return;
      }

      const response = await fetch(API_ENDPOINTS.ADMIN_CHATBOT_BY_ID(selectedChatbot.id), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = (await parseJsonSafe(response)) || {};
        throw new Error(errorData.detail || 'Không thể cập nhật chatbot');
      }

      setSuccess('Chatbot đã được cập nhật thành công!');
      fetchChatbots();
      closeModal();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteChatbot = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN_CHATBOT_BY_ID(selectedChatbot.id), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = (await parseJsonSafe(response)) || {};
        throw new Error(errorData.detail || 'Không thể xóa chatbot');
      }

      setSuccess('Chatbot đã được xóa thành công!');
      fetchChatbots();
      closeModal();
    } catch (err) {
      setError(err.message);
    }
  };

  const openCreateModal = () => {
    setModalMode('create');
    setFormData({ name: '', source: '', prompt: '' });
    setAvatarFile(null);
    setAvatarPreview('');
    setShowModal(true);
  };

  const openEditModal = (chatbot) => {
    setModalMode('edit');
    setSelectedChatbot(chatbot);
    setFormData({
      name: chatbot.name,
      source: chatbot.source || chatbot.quizTopic || '',
      prompt: chatbot.prompt
    });
    setAvatarFile(null);
    setAvatarPreview(chatbot.avatar || '');
    setShowModal(true);
  };

  const openDeleteModal = (chatbot) => {
    setModalMode('delete');
    setSelectedChatbot(chatbot);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedChatbot(null);
    setFormData({ name: '', source: '', prompt: '' });
    setAvatarFile(null);
    setAvatarPreview('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (modalMode === 'create') {
      handleCreateChatbot();
    } else if (modalMode === 'edit') {
      handleUpdateChatbot();
    } else if (modalMode === 'delete') {
      handleDeleteChatbot();
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setAvatarFile(null);
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Định dạng ảnh không hợp lệ. Hỗ trợ: JPG, PNG, GIF, WebP.');
      e.target.value = '';
      setAvatarFile(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Ảnh avatar tối đa 5MB.');
      e.target.value = '';
      setAvatarFile(null);
      return;
    }

    setError('');
    setAvatarFile(file);

    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const parseJsonSafe = async (response) => {
    try {
      const text = await response.text();
      if (!text) return null;
      return JSON.parse(text);
    } catch {
      return null;
    }
  };

  const getApiError = async (response, fallbackMessage) => {
    const data = await parseJsonSafe(response);
    return data?.detail || data?.message || fallbackMessage;
  };

  // Function để xử lý hiển thị avatar
  const getAvatarSrc = (avatar) => {
    if (!avatar) {
      return 'https://cdn-icons-png.flaticon.com/512/1698/1698535.png';
    }
    
    // Kiểm tra nếu là base64 data URL
    if (avatar.startsWith('data:image/')) {
      return avatar;
    }
    
    // Nếu là base64 string thuần (không có prefix), thêm prefix
    if (avatar.match(/^[A-Za-z0-9+/=]+$/)) {
      return `data:image/jpeg;base64,${avatar}`;
    }
    
    // Nếu là URL thông thường
    if (avatar.startsWith('http')) {
      return avatar;
    }
    
    // Fallback
    return 'https://cdn-icons-png.flaticon.com/512/1698/1698535.png';
  };

  // Lọc chatbot theo từ khóa (tên, mã môn, id, prompt)
  const keyword = searchTerm.trim().toLowerCase();
  const filteredChatbots = keyword
    ? chatbots.filter((chatbot) => {
        const topicCode = chatbot.source || chatbot.quizTopic || '';
        return [String(chatbot.id), chatbot.name, topicCode, chatbot.prompt]
          .some((field) => (field || '').toLowerCase().includes(keyword));
      })
    : chatbots;

  // Phân trang danh sách chatbot
  const totalPages = Math.max(1, Math.ceil(filteredChatbots.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedChatbots = filteredChatbots.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-100 to-pink-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-red-100 to-pink-100 flex flex-col" style={{ paddingTop: '100px' }}>
      <Navbar />

      <div className="container mx-auto px-4 py-8 flex-1">
        {/* Messages */}
        {(error || success) && (
          <div className={`p-4 rounded-lg mb-6 ${error ? 'bg-red-100 border border-red-400 text-red-700' : 'bg-green-100 border border-green-400 text-green-700'}`}>
            <div className="flex justify-between items-center">
              <p>{error || success}</p>
              <button onClick={clearMessages} className="text-xl font-bold">×</button>
            </div>
          </div>
        )}

        {/* Link: API performance dashboard (usage, latency, tokens, cost from Langfuse) */}
        <a
          href="/mini/admin/performance"
          className="group bg-white rounded-lg shadow-lg p-5 mb-4 flex flex-wrap sm:flex-nowrap items-center gap-4 hover:shadow-xl transition-shadow"
        >
          <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center flex-none">
            <FaTachometerAlt className="text-white text-xl" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-800">Hiệu năng API</h2>
            <p className="text-sm text-gray-600">
              Lượng dùng, độ trễ, token và chi phí của chatbot (Langfuse) theo khoảng thời gian bất kỳ, so với kỳ trước.
            </p>
          </div>
          <span className="text-sm font-semibold text-red-600 whitespace-nowrap group-hover:underline">
            Mở dashboard →
          </span>
        </a>

        {/* ===== Section: Quản lý Chatbot (tách riêng) ===== */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 mb-1 flex items-center">
                <FaRobot className="w-7 h-7 mr-3 inline-block align-middle" style={{ color: colors.primary }} />
                Quản lý Chatbot
              </h1>
              <p className="text-sm text-gray-600">
                Tạo / sửa / xóa chatbot (tên, prompt, avatar, mã môn).
              </p>
            </div>
            <button
              onClick={openCreateModal}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 transform hover:scale-105 flex items-center"
            >
              <FaPlus className="w-4 h-4 mr-2 inline-block align-middle" />
              Thêm Chatbot
            </button>
          </div>

          {/* Ô tìm kiếm */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <FaSearch className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm theo tên, mã môn, ID hoặc prompt..."
                className="w-full border border-gray-300 rounded-lg pl-10 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  title="Xóa tìm kiếm"
                >
                  <FaTimes className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-sm text-gray-600 whitespace-nowrap">
              {filteredChatbots.length}/{chatbots.length} chatbot
            </p>
          </div>
        </div>

        {/* Chatbot List */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avatar</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mã môn</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prompt</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pagedChatbots.map((chatbot) => {
                  const topicCode = chatbot.source || chatbot.quizTopic || '';
                  return (
                  <tr key={chatbot.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {chatbot.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-10 w-10 rounded-full bg-white border border-gray-200 flex items-center justify-center p-1">
                        <img 
                          src={getAvatarSrc(chatbot.avatar)} 
                          alt={chatbot.name}
                          className="h-8 w-8 rounded-full object-cover"
                          onError={(e) => {
                            e.target.src = 'https://cdn-icons-png.flaticon.com/512/1698/1698535.png';
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {chatbot.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {topicCode || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                      <div className="truncate" title={chatbot.prompt}>
                        {chatbot.prompt ? chatbot.prompt.substring(0, 80) + (chatbot.prompt.length > 80 ? '...' : '') : 'Chưa có prompt'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openEditModal(chatbot)}
                          className="text-blue-600 hover:text-blue-900 p-2 rounded hover:bg-blue-100"
                          title="Chỉnh sửa"
                        >
                          <FaEdit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(chatbot)}
                          className="text-red-600 hover:text-red-900 p-2 rounded hover:bg-red-100"
                          title="Xóa"
                        >
                          <FaTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
          {filteredChatbots.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Hiển thị {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredChatbots.length)} / {filteredChatbots.length} chatbot
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(safePage - 1)}
                  disabled={safePage === 1}
                  className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-40 hover:bg-gray-100"
                >
                  Trước
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 rounded border text-sm ${
                      page === safePage
                        ? 'bg-red-600 border-red-600 text-white'
                        : 'border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCurrentPage(safePage + 1)}
                  disabled={safePage === totalPages}
                  className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-40 hover:bg-gray-100"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
          {filteredChatbots.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <FaRobot className="w-24 h-24 mb-4 text-gray-300 mx-auto" />
              <p className="text-xl">
                {chatbots.length === 0
                  ? 'Chưa có chatbot nào'
                  : `Không tìm thấy chatbot nào khớp với "${searchTerm}"`}
              </p>
            </div>
          )}
        </div>


      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {modalMode === 'create' && 'Thêm Chatbot Mới'}
                  {modalMode === 'edit' && 'Chỉnh Sửa Chatbot'}
                  {modalMode === 'delete' && 'Xác Nhận Xóa'}
                </h3>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FaTimes className="w-5 h-5" />
                </button>
              </div>

              {modalMode === 'delete' ? (
                <div>
                  <div className="text-center mb-6">
                    <FaExclamationTriangle className="w-24 h-24 text-red-500 mb-4 mx-auto" />
                    <p className="text-gray-700">
                      Bạn có chắc chắn muốn xóa chatbot <strong>{selectedChatbot?.name}</strong>?
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      Hành động này không thể hoàn tác.
                    </p>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={closeModal}
                      className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 font-bold py-2 px-4 rounded"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={handleSubmit}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tên Chatbot
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                        placeholder="Nhập tên chatbot"
                        required={modalMode === 'create'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Mã môn
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formData.source}
                          onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                          onBlur={(e) => setFormData({ ...formData, source: normalizeTopicCode(e.target.value) })}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                          placeholder="VD: marketing101"
                        />
                        {modalMode === 'create' && (
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, source: generateSourceAndQuizTopic(formData.name) })}
                            disabled={!formData.name}
                            className="whitespace-nowrap bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-700 text-sm font-medium px-3 rounded-lg"
                            title="Tự sinh mã môn từ tên chatbot"
                          >
                            Tự sinh
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Chỉ dùng chữ cái không dấu, số, "-" hoặc "_" (tối thiểu 3 ký tự).
                        {modalMode === 'create'
                          ? ' Để trống sẽ tự sinh từ tên chatbot.'
                          : ' Đổi mã môn sẽ ảnh hưởng tới dữ liệu/tài liệu đã gắn với mã cũ.'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Avatar
                      </label>
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                        onChange={handleAvatarChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                        required={modalMode === 'create' && !avatarPreview}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Hỗ trợ: JPG, PNG, GIF, WebP. Tối đa 5MB.
                      </p>
                      {avatarPreview && (
                        <div className="mt-3 flex justify-center">
                          <div className="h-20 w-20 rounded-full bg-white border border-gray-300 flex items-center justify-center p-2">
                            <img 
                              src={getAvatarSrc(avatarPreview)} 
                              alt="Avatar preview"
                              className="h-16 w-16 rounded-full object-cover"
                              onError={(e) => {
                                e.target.src = 'https://cdn-icons-png.flaticon.com/512/1698/1698535.png';
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Prompt
                      </label>
                      <textarea
                        value={formData.prompt}
                        onChange={(e) => setFormData({...formData, prompt: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                        placeholder="Nhập prompt mô tả vai trò và chức năng của chatbot"
                        rows="4"
                        required={modalMode === 'create'}
                      />
                    </div>
                  </div>
                  
                  <div className="flex space-x-3 mt-6">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 font-bold py-2 px-4 rounded"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded flex items-center justify-center"
                    >
                      <FaSave className="w-4 h-4 mr-2 inline-block align-middle" />
                      {modalMode === 'create' ? 'Tạo' : 'Cập nhật'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default AdminDashboard; 