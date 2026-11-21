/**
 * 編集画面（Options Page）の入口
 */
import { mount } from 'svelte';
import App from './App.svelte';
import './style.css';

document.documentElement.lang = browser.i18n.getUILanguage();
mount(App, { target: document.getElementById('app')! });
