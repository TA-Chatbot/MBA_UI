// "Nhận xét chính": the backend's rule-based observations, each marked with the
// topic it is about.
import React from 'react';
import {
  FaChartLine, FaCalendarDay, FaClock, FaBook, FaUsers, FaTachometerAlt, FaStopwatch,
  FaCheckCircle, FaCoins, FaMicrochip, FaInfoCircle, FaLightbulb,
} from 'react-icons/fa';
import { Section, EmptyNote, list } from './common';

const KINDS = {
  traffic: { icon: FaChartLine, label: 'Lưu lượng' },
  peak: { icon: FaCalendarDay, label: 'Cao điểm' },
  slot: { icon: FaClock, label: 'Khung giờ' },
  course: { icon: FaBook, label: 'Môn học' },
  users: { icon: FaUsers, label: 'Người dùng' },
  latency: { icon: FaTachometerAlt, label: 'Độ trễ' },
  sla: { icon: FaStopwatch, label: 'Ngưỡng độ trễ' },
  errors: { icon: FaCheckCircle, label: 'Lỗi' },
  cost: { icon: FaCoins, label: 'Chi phí' },
  model: { icon: FaMicrochip, label: 'Model' },
  data: { icon: FaInfoCircle, label: 'Dữ liệu' },
};

export default function Highlights({ highlights }) {
  const items = list(highlights).filter((h) => h && h.text);
  return (
    <Section id="perf-highlights" title="Nhận xét chính" icon={FaLightbulb}>
      {items.length === 0 ? (
        <EmptyNote>Không có nhận xét cho khoảng thời gian này.</EmptyNote>
      ) : (
        <ul className="space-y-3.5">
          {items.map((h, i) => {
            const kind = KINDS[h.kind] || { icon: FaInfoCircle, label: h.kind || 'Nhận xét' };
            const Icon = kind.icon;
            return (
              <li key={i} className="flex gap-3">
                <span
                  className="flex-none w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center"
                  title={kind.label}
                >
                  <Icon className="text-sm" aria-hidden="true" />
                  <span className="sr-only">{kind.label}: </span>
                </span>
                <p className="text-sm text-gray-700 leading-relaxed pt-1">{h.text}</p>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
