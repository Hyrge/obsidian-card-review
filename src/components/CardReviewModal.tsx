import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { MarkdownRenderer, Component } from 'obsidian';

interface CardReviewModalProps {
  cards: { id: string; text: string; source: string; createdAt: number }[];
  onKeep: (id: string) => void;
  onDiscard: (id: string) => void;
  component: Component;
}

export function CardReviewModal({ cards, onKeep, onDiscard, component }: CardReviewModalProps) {
  if (cards.length === 0) return <div>리뷰할 카드가 없습니다.</div>;
  const card = cards[0];
  const mdRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mdRef.current) {
      mdRef.current.innerHTML = '';
      MarkdownRenderer.renderMarkdown(card.text, mdRef.current, '', component);
    }
  }, [card.id, card.text, component]);

  return (
    <div class="card-review-modal">
      <div class="card-review-header">
        <h2>카드 리뷰</h2>
      </div>
      <div class="card-review-content">
        <div
          class="card-text markdown-preview-view"
          ref={mdRef}
        />
        <div class="card-source">
          <small>출처: {card.source}</small>
          <small>생성일: {new Date(card.createdAt).toLocaleDateString()}</small>
        </div>
      </div>
      <div class="card-review-footer">
        <div class="card-review-buttons">
          <button class="mod-warning" onClick={() => onDiscard(card.id)}>버리기</button>
          <button class="mod-cta" onClick={() => onKeep(card.id)}>저장하기</button>
        </div>
      </div>
    </div>
  );
} 
