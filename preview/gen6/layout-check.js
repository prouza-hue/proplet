'use strict';
const viewportSizes={mobile:[390,844],fold:[768,900],desktop:[1440,900]};
const viewport=viewportSizes[new URLSearchParams(location.search).get('size')]||viewportSizes.mobile;
const previewFrame=document.querySelector('#previewFrame');
previewFrame.width=viewport[0];previewFrame.height=viewport[1];
