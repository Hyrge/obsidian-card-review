import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { CardData } from '../types';

interface SourceSelectionModalProps {
  cards: CardData[];
  onStartReview: (selectedCards: CardData[]) => void;
  onClose: () => void;
}

export function SourceSelectionModal({ cards, onStartReview, onClose }: SourceSelectionModalProps) {
  const [selectedDirectory, setSelectedDirectory] = useState<string | null>(null);
  
  const directories = cards.reduce((acc, card) => {
    const dir = card.directory || '기본함';
    if (!acc[dir]) {
      acc[dir] = [];
    }
    acc[dir].push(card);
    return acc;
  }, {} as Record<string, CardData[]>);

  const sources = selectedDirectory 
    ? directories[selectedDirectory].reduce((acc, card) => {
        if (!acc[card.source]) {
          acc[card.source] = [];
        }
        acc[card.source].push(card);
        return acc;
      }, {} as Record<string, CardData[]>)
    : {};

  const handleDirectorySelect = (directory: string) => {
    if (selectedDirectory === directory) {
      onStartReview(directories[directory]);
    } else {
      setSelectedDirectory(directory);
    }
  };

  const handleSourceSelect = (source: string) => {
    onStartReview(sources[source]);
  };

  const handleStartAllInDirectory = () => {
    if (selectedDirectory) {
      onStartReview(directories[selectedDirectory]);
    }
  };

  return (
    <div class="source-selection-modal">
      <div class="source-selection-header">
        <h2>리뷰할 카드 선택</h2>
        <button class="start-all-button" onClick={() => onStartReview(cards)}>모든 카드 리뷰</button>
      </div>

      <div class="source-selection-content">
        {!selectedDirectory ? (
          <div class="directory-selection">
            <h3>폴더 선택</h3>
            <div class="directory-grid">
              <div class="directory-tile all-cards" onClick={() => onStartReview(cards)}>
                <div class="directory-icon" aria-hidden>📚</div>
                <div class="directory-title">모든 카드</div>
                <div class="directory-count">{cards.length}개</div>
              </div>
              {Object.entries(directories).map(([directory, dirCards]) => (
                <div
                  key={directory}
                  class="directory-tile"
                  onClick={() => handleDirectorySelect(directory)}
                >
                  <div class="directory-icon" aria-hidden>📁</div>
                  <div class="directory-title">{directory}</div>
                  <div class="directory-count">{dirCards.length}개</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div class="source-selection">
            <div class="breadcrumb">
              <button onClick={() => setSelectedDirectory(null)}>← 폴더 선택</button>
              <span>📁 {selectedDirectory}</span>
            </div>
            
            <div class="source-list">
              <div class="source-item all-sources" onClick={handleStartAllInDirectory}>
                <div class="source-name">📄 이 폴더의 모든 노트</div>
                <div class="source-count">{directories[selectedDirectory].length}개</div>
              </div>
              {Object.entries(sources).map(([source, sourceCards]) => (
                <div 
                  key={source} 
                  class="source-item"
                  onClick={() => handleSourceSelect(source)}
                >
                  <div class="source-name">📄 {source}</div>
                  <div class="source-count">{sourceCards.length}개</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div class="source-selection-footer">
        <button onClick={onClose}>취소</button>
      </div>
    </div>
  );
}
