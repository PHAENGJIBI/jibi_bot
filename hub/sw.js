// JIBI Hub — service worker เล็กๆ ให้ติดตั้งเป็นแอปได้ (ไม่เก็บแคชข้อมูล เพื่อให้เห็นข้อมูลสดเสมอ)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
