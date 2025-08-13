import { App, Modal } from 'obsidian';
import { h, render } from 'preact';
import { SourceSelectionModal } from './components/SourceSelectionModal';
import type { CardData } from './types';
import type CardReviewPlugin from './main';

export class PreactSourceSelectionModal extends Modal {
	plugin: CardReviewPlugin;
	cards: CardData[];
	onStartReview: (selectedCards: CardData[]) => void;

	constructor(app: App, plugin: CardReviewPlugin, cards: CardData[], onStartReview: (selectedCards: CardData[]) => void) {
		super(app);
		this.plugin = plugin;
		this.cards = cards;
		this.onStartReview = onStartReview;
	}

	onOpen() {
		const { contentEl } = this;
		
		const handleStartReview = (selectedCards: CardData[]) => {
			this.close();
			this.onStartReview(selectedCards);
		};

		const handleClose = () => {
			this.close();
		};

		render(
			h(SourceSelectionModal, {
				cards: this.cards,
				onStartReview: handleStartReview,
				onClose: handleClose
			}),
			contentEl
		);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}