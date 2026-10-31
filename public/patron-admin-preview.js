import {patronsView} from './admin/patrons.js';
patronsView(document.getElementById('mainContent'));

document.querySelector('.brand').href='/patron-preview.html?state='+encodeURIComponent(window.PropletStudioFixture.fixtureState);
