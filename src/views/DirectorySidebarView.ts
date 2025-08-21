import { ItemView, WorkspaceLeaf } from 'obsidian';
import { h, render } from 'preact';
import { DirectorySidebar } from '../components/DirectorySidebar';
import type CardReviewPlugin from '../main';

export const DIRECTORY_SIDEBAR_VIEW = 'card-directory-sidebar';

export class DirectorySidebarView extends ItemView {
	plugin: CardReviewPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: CardReviewPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() { return DIRECTORY_SIDEBAR_VIEW; }
	getDisplayText() { return '카드 디렉토리'; }
	getIcon() { return 'folders'; }

	onOpen() {
		const container = this.contentEl;
		container.empty();
		render(h(DirectorySidebar, { plugin: this.plugin }), container);
	}

	onClose() {
		this.contentEl.empty();
	}
}

