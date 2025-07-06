import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, ButtonComponent } from 'obsidian';

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
}

const DEFAULT_SETTINGS: CardReviewSettings = {
	autoSave: true,
	reviewBatchSize: 10
}

export default class CardReviewPlugin extends Plugin {
	settings: CardReviewSettings;
	cards: CardData[] = [];

	async onload() {
		await this.loadSettings();
		await this.loadCards();

		// 리본 아이콘 추가
		this.addRibbonIcon('cards', '카드 리뷰', (evt: MouseEvent) => {
			this.startCardReview();
		});

		// 선택한 텍스트를 카드로 만들기 명령어
		this.addCommand({
			id: 'create-card-from-selection',
			name: '선택한 텍스트를 카드로 만들기',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const selection = editor.getSelection();
				if (selection.trim().length === 0) {
					new Notice('텍스트를 선택해주세요.');
					return;
				}
				this.createCard(selection, view.file?.path || '알 수 없음');
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
				new AllCardsModal(this.app, this).open();
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
	}

	async startCardReview() {
		const unreviewed = this.cards.filter(card => !card.reviewed);
		
		if (unreviewed.length === 0) {
			new Notice('리뷰할 카드가 없습니다.');
			return;
		}

		new CardReviewModal(this.app, this, unreviewed).open();
	}

	async saveCard(cardId: string, keep: boolean) {
		const card = this.cards.find(c => c.id === cardId);
		if (card) {
			card.reviewed = true;
			card.kept = keep;
			await this.saveCards();
		}
	}

	async deleteCard(cardId: string) {
		this.cards = this.cards.filter(c => c.id !== cardId);
		await this.saveCards();
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
}

class CardReviewModal extends Modal {
	plugin: CardReviewPlugin;
	cards: CardData[];
	currentIndex: number = 0;
	keptCards: number = 0;

	constructor(app: App, plugin: CardReviewPlugin, cards: CardData[]) {
		super(app);
		this.plugin = plugin;
		this.cards = cards;
	}

	onOpen() {
		this.displayCurrentCard();
	}

	displayCurrentCard() {
		const { contentEl } = this;
		contentEl.empty();

		if (this.currentIndex >= this.cards.length) {
			this.displayComplete();
			return;
		}

		const card = this.cards[this.currentIndex];
		
		contentEl.createEl('h2', { text: '카드 리뷰' });
		contentEl.createEl('p', { text: `${this.currentIndex + 1} / ${this.cards.length}` });
		
		const cardContainer = contentEl.createEl('div', { cls: 'card-review-container' });
		const cardText = cardContainer.createEl('div', { cls: 'card-text' });
		cardText.createEl('p', { text: card.text });
		
		const sourceInfo = cardContainer.createEl('div', { cls: 'card-source' });
		sourceInfo.createEl('small', { text: `출처: ${card.source}` });
		sourceInfo.createEl('small', { text: `생성일: ${new Date(card.createdAt).toLocaleDateString()}` });

		const buttonContainer = contentEl.createEl('div', { cls: 'card-review-buttons' });
		
		const discardBtn = new ButtonComponent(buttonContainer);
		discardBtn.setButtonText('버리기')
			.setClass('mod-warning')
			.onClick(() => this.handleCardDecision(false));

		const keepBtn = new ButtonComponent(buttonContainer);
		keepBtn.setButtonText('저장하기')
			.setClass('mod-cta')
			.onClick(() => this.handleCardDecision(true));

		// 키보드 단축키
		this.scope.register([], 'ArrowLeft', () => this.handleCardDecision(false));
		this.scope.register([], 'ArrowRight', () => this.handleCardDecision(true));
		this.scope.register([], 'Space', () => this.handleCardDecision(true));
	}

	async handleCardDecision(keep: boolean) {
		const card = this.cards[this.currentIndex];
		if (keep) {
			await this.plugin.saveCard(card.id, true);
			this.keptCards++;
		} else {
			await this.plugin.deleteCard(card.id); // 완전 삭제
			this.cards.splice(this.currentIndex, 1); // 현재 모달의 배열에서도 즉시 제거
			this.currentIndex--; // 인덱스 보정
		}
		this.currentIndex++;
		this.displayCurrentCard();
	}

	displayComplete() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: '리뷰 완료!' });
		contentEl.createEl('p', { text: '모든 카드 리뷰가 완료되었습니다.' });
		contentEl.createEl('p', { text: `저장된 카드: ${this.keptCards}개` });
		const closeBtn = new ButtonComponent(contentEl);
		closeBtn.setButtonText('닫기')
			.setClass('mod-cta')
			.onClick(() => this.close());
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class AllCardsModal extends Modal {
	plugin: CardReviewPlugin;

	constructor(app: App, plugin: CardReviewPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: '모든 카드' });

		const stats = contentEl.createEl('div', { cls: 'card-stats' });
		const total = this.plugin.cards.length;
		const reviewed = this.plugin.cards.filter(c => c.reviewed).length;
		const unreviewed = this.plugin.cards.filter(c => !c.reviewed).length;

		stats.createEl('p', { text: `총 카드: ${total}개` });
		stats.createEl('p', { text: `저장된 카드: ${reviewed}개` });
		stats.createEl('p', { text: `리뷰 대기: ${unreviewed}개` });

		const cardsList = contentEl.createEl('div', { cls: 'cards-list' });
		this.plugin.cards.forEach(card => {
			const cardEl = cardsList.createEl('div', { cls: 'card-item' });
			const cardContent = cardEl.createEl('div', { cls: 'card-content' });
			cardContent.createEl('p', { text: card.text });
			const cardMeta = cardContent.createEl('div', { cls: 'card-meta' });
			cardMeta.createEl('small', { text: `출처: ${card.source}` });
			cardMeta.createEl('small', { text: `생성일: ${new Date(card.createdAt).toLocaleDateString()}` });
			const cardStatus = cardEl.createEl('div', { cls: 'card-status' });
			if (card.reviewed) {
				cardStatus.createEl('span', { text: '저장됨', cls: 'status-kept' });
			} else {
				cardStatus.createEl('span', { text: '리뷰 대기', cls: 'status-pending' });
			}
			const deleteBtn = new ButtonComponent(cardEl);
			deleteBtn.setButtonText('삭제')
				.setClass('mod-warning')
				.onClick(() => this.deleteCard(card.id));
		});
	}

	async deleteCard(cardId: string) {
		await this.plugin.deleteCard(cardId);
		this.onOpen(); // 목록 새로고침
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
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
	}
}
