import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, ButtonComponent } from 'obsidian';
import { h, render } from 'preact';
import { CardReviewModal } from './components/CardReviewModal';
import { AllCardsView, ALL_CARDS_VIEW_TYPE } from './views/AllCardsView';

// Remember to rename these classes and interfaces!

interface CardData {
	id: string;
	text: string;
	source: string;
	createdAt: number;
	reviewed: boolean;
	kept: boolean;
}

interface CardReviewSettings {
	autoSave: boolean;
	reviewBatchSize: number;
	mobileFullWidth: boolean;
}

const DEFAULT_SETTINGS: CardReviewSettings = {
	autoSave: true,
	reviewBatchSize: 10,
	mobileFullWidth: false
}

export default class CardReviewPlugin extends Plugin {
	settings!: CardReviewSettings;
	cards: CardData[] = [];

	async onload() {
		await this.loadSettings();
		await this.loadCards();
		
		// 모바일 전체 너비 모드 적용
		this.applyMobileFullWidth();

		// AllCardsView 등록
		this.registerView(ALL_CARDS_VIEW_TYPE, (leaf) => new AllCardsView(leaf, this));

		// 리본 아이콘 추가
		this.addRibbonIcon('cards', '카드 리뷰', (evt: MouseEvent) => {
			this.startCardReview();
		});

		// 선택한 텍스트를 카드로 만들기 명령어
		this.addCommand({
			id: 'create-card-from-selection',
			name: '선택한 텍스트를 카드로 만들기',
			editorCallback: (editor: Editor, ctx: MarkdownView | any) => {
				const selection = editor.getSelection();
				if (selection.trim().length === 0) {
					new Notice('텍스트를 선택해주세요.');
					return;
				}
				if ('file' in ctx && ctx.file) {
					this.createCard(selection, (ctx.file as TFile)?.path || '알 수 없음');
				} else {
					new Notice('마크다운 파일에서만 사용할 수 있습니다.');
				}
			}
		});

		// 카드 리뷰 시작 명령어
		this.addCommand({
			id: 'start-card-review',
			name: '카드 리뷰',
			callback: () => {
				this.startCardReview();
			}
		});

		// 모든 카드 보기 명령어
		this.addCommand({
			id: 'view-all-cards',
			name: '모든 카드 보기',
			callback: () => {
				this.openAllCardsView();
			}
		});

		// 모든 카드 리셋 명령어
		this.addCommand({
			id: 'reset-all-cards',
			name: '모든 카드 리셋 (다시 리뷰 대기 상태로)',
			callback: async () => {
				const reviewedCards = this.cards.filter(card => card.reviewed);
				if (reviewedCards.length === 0) {
					new Notice('리셋할 카드가 없습니다.');
					return;
				}
				
				await this.resetAllCards();
				new Notice(`${reviewedCards.length}개의 카드가 리뷰 대기 상태로 리셋되었습니다.`);
			}
		});

		// 설정 탭 추가
		this.addSettingTab(new CardReviewSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {
		// 플러그인 언로드 시 정리
	}

	async createCard(text: string, source: string) {
		const card: CardData = {
			id: Date.now().toString(),
			text: text.trim(),
			source: source,
			createdAt: Date.now(),
			reviewed: false,
			kept: false
		};

		this.cards.push(card);
		await this.saveCards();
		
		new Notice(`카드가 생성되었습니다: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
		
		// AllCardsView가 열려있으면 새로고침
		this.refreshAllCardsView();
	}

	async startCardReview() {
		const unreviewed = this.cards.filter(card => !card.reviewed);
		
		if (unreviewed.length === 0) {
			// 리뷰할 카드가 없을 때, 리뷰 완료된 카드가 있는지 확인
			const reviewedCards = this.cards.filter(card => card.reviewed);
			
			if (reviewedCards.length > 0) {
				// 모든 카드를 리셋하여 다시 리뷰 가능하게 함
				await this.resetAllCards();
				new Notice('모든 카드 리뷰가 완료되었습니다! 다시 처음부터 리뷰를 시작합니다.');
				
				// 리셋 후 다시 리뷰 시작
				const resetUnreviewed = this.cards.filter(card => !card.reviewed);
				if (resetUnreviewed.length > 0) {
					new PreactCardReviewModal(this.app, this, resetUnreviewed).open();
				}
			} else {
				new Notice('리뷰할 카드가 없습니다.');
			}
			return;
		}

		new PreactCardReviewModal(this.app, this, unreviewed).open();
	}

	async resetAllCards() {
		// 모든 저장된 카드의 reviewed 상태를 false로 리셋
		this.cards.forEach(card => {
			if (card.kept) {  // 저장된 카드만 리셋 (버려진 카드는 이미 삭제됨)
				card.reviewed = false;
			}
		});
		
		await this.saveCards();
		this.refreshAllCardsView();
	}

	async openAllCardsView() {
		const existing = this.app.workspace.getLeavesOfType(ALL_CARDS_VIEW_TYPE);
		if (existing.length > 0) {
			// 이미 열려있으면 해당 탭으로 이동
			this.app.workspace.revealLeaf(existing[0]);
		} else {
			// 새로 열기
			await this.app.workspace.getLeaf(true).setViewState({
				type: ALL_CARDS_VIEW_TYPE,
				active: true
			});
		}
	}

	refreshAllCardsView() {
		const leaves = this.app.workspace.getLeavesOfType(ALL_CARDS_VIEW_TYPE);
		leaves.forEach(leaf => {
			if (leaf.view instanceof AllCardsView) {
				leaf.view.refresh();
			}
		});
	}

	async saveCard(cardId: string, keep: boolean) {
		const card = this.cards.find(c => c.id === cardId);
		if (card) {
			card.reviewed = true;
			card.kept = keep;
			await this.saveCards();
			this.refreshAllCardsView();
		}
	}

	async deleteCard(cardId: string) {
		this.cards = this.cards.filter(c => c.id !== cardId);
		await this.saveCards();
		this.refreshAllCardsView();
	}

	async loadCards() {
		const data = await this.loadData();
		this.cards = data?.cards || [];
	}

	async saveCards() {
		await this.saveData({ cards: this.cards });
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	applyMobileFullWidth() {
		if (this.settings.mobileFullWidth) {
			document.body.classList.add('mobile-full-width');
		} else {
			document.body.classList.remove('mobile-full-width');
		}
	}
}

class PreactCardReviewModal extends Modal {
	plugin: CardReviewPlugin;
	cards: CardData[];

	constructor(app: App, plugin: CardReviewPlugin, cards: CardData[]) {
		super(app);
		this.plugin = plugin;
		this.cards = cards;
	}

	onOpen() {
		const { contentEl } = this;
		const handleKeep = async (id: string) => {
			await this.plugin.saveCard(id, true);
			this.cards = this.cards.filter(card => card.id !== id);
			if (this.cards.length === 0) {
				this.close();
			} else {
				this.rerender();
			}
		};
		const handleDiscard = async (id: string) => {
			await this.plugin.deleteCard(id);
			this.cards = this.cards.filter(card => card.id !== id);
			if (this.cards.length === 0) {
				this.close();
			} else {
				this.rerender();
			}
		};
		this.rerender = () => {
			contentEl.empty();
			render(
				h(CardReviewModal, {
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

class CardReviewSettingTab extends PluginSettingTab {
	plugin: CardReviewPlugin;

	constructor(app: App, plugin: CardReviewPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: '카드 리뷰 설정' });

		new Setting(containerEl)
			.setName('자동 저장')
			.setDesc('카드 리뷰 시 자동으로 저장할지 선택')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSave)
				.onChange(async (value) => {
					this.plugin.settings.autoSave = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('리뷰 배치 크기')
			.setDesc('한 번에 리뷰할 카드 수')
			.addSlider(slider => slider
				.setLimits(1, 50, 1)
				.setValue(this.plugin.settings.reviewBatchSize)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.reviewBatchSize = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('모바일 전체 너비 모드')
			.setDesc('카드 리뷰 모달을 전체 너비(100%)로 표시합니다 (모바일 환경에 유용)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.mobileFullWidth)
				.onChange(async (value) => {
					this.plugin.settings.mobileFullWidth = value;
					await this.plugin.saveSettings();
					this.plugin.applyMobileFullWidth();
				}));
	}
}
