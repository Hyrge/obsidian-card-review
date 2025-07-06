import { App, Modal } from 'obsidian';
import { h, render } from 'preact';
import { CardReviewModal } from './components/CardReviewModal';
import type { CardData } from './types';
import type CardReviewPlugin from './main';

export class PreactCardReviewModal extends Modal {
	plugin: CardReviewPlugin;
	cards: CardData[];

	constructor(app: App, plugin: CardReviewPlugin, cards: CardData[]) {
		super(app);
		this.plugin = plugin;
		this.cards = cards;
	}

	onOpen() {
		const { contentEl } = this;
		const handleKeep = (id: string) => {
			// UI 먼저 업데이트 (즉시 반응)
			this.cards = this.cards.filter(card => card.id !== id);
			
			if (this.cards.length === 0) {
				this.close();
			} else {
				this.rerender();
			}
			
			// 데이터 저장은 백그라운드에서 처리
			this.plugin.saveCard(id, true).catch(error => {
				console.error('카드 저장 중 오류:', error);
			});
		};
		
		const handleDiscard = (id: string) => {
			// UI 먼저 업데이트 (즉시 반응)
			this.cards = this.cards.filter(card => card.id !== id);
			
			if (this.cards.length === 0) {
				this.close();
			} else {
				this.rerender();
			}
			
			// 데이터 삭제는 백그라운드에서 처리
			this.plugin.deleteCard(id).catch(error => {
				console.error('카드 삭제 중 오류:', error);
			});
		};
		
		this.rerender = () => {
			contentEl.empty();
			render(
				h(CardReviewModal, {
					key: this.cards.length > 0 ? this.cards[0].id : 'no-cards',
					cards: this.cards,
					onKeep: handleKeep,
					onDiscard: handleDiscard,
					component: this.plugin
				}),
				contentEl
			);
		};
		this.rerender();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
	
	private rerender: () => void = () => {};
} 
