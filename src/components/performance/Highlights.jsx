import React from 'react';
import { Section, EmptyNote, list } from './common';

const KIND_LABELS = {
  traffic: 'Lưu lượng',
  peak: 'Cao điểm',
  slot: 'Khung giờ',
  course: 'Môn học',
  users: 'User',
  latency: 'Độ trễ',
  sla: 'Ngưỡng',
  errors: 'Lỗi',
  cost: 'Chi phí',
  model: 'Model',
  data: 'Dữ liệu',
};

export default function Highlights({ highlights }) {
  const items = list(highlights).filter((h) => h && h.text);
  return (
    <Section id="perf-highlights" title="Nhận xét chính">
      {items.length === 0 ? (
        <EmptyNote>Không có nhận xét cho khoảng thời gian này.</EmptyNote>
      ) : (
        <ul className="space-y-2">
          {items.map((h, i) => (
            <li key={i} className="flex gap-3 text-sm text-gray-800 leading-relaxed">
              <span className="flex-none mt-0.5 w-20 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {KIND_LABELS[h.kind] || h.kind || '•'}
              </span>
              <span>{h.text}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
