import { PluginSettingTab, Setting } from 'obsidian';
import type CardReviewPlugin from './main';

export class CardReviewSettingTab extends PluginSettingTab {
	plugin: CardReviewPlugin;

	constructor(app: any, plugin: CardReviewPlugin) {
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
			.setName('랜덤 모드')
			.setDesc('카드 리뷰 시 카드를 랜덤 순서로 표시합니다')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.randomMode)
				.onChange(async (value) => {
					this.plugin.settings.randomMode = value;
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
