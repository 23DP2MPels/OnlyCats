# PayPal Sandbox

В приложении жёстко задан `https://api-m.sandbox.paypal.com`.
Настройки переключения на Live нет. В тесте HTTP-симуляции адрес меняется только
в памяти отдельного тестового процесса.

1. Откройте [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/).
2. Создайте Sandbox REST app и тестовые Business (продавец) / Personal (покупатель) аккаунты.
3. Запишите Client ID и Client Secret в `backend/.env` для обычного запуска или корневой `.env` для Compose.
   Секреты не отправляйте в чат и не коммитьте.
4. Создайте продукт и месячный план на 5 USD:

```powershell
npm run paypal:setup -w backend
# Или для Compose:
docker compose exec backend npm run paypal:setup
```

5. Сохраните выведенный `PAYPAL_PLAN_ID` в соответствующий `.env`. Команда создаёт
   новый продукт и план при каждом запуске, поэтому повторно её не запускайте без необходимости.
6. Для webhook нужен доступный PayPal HTTPS URL:
   `https://YOUR_HOST/api/payments/paypal/webhook`. Создайте его в настройках Sandbox app.
   Подпишитесь на `BILLING.SUBSCRIPTION.ACTIVATED`, `.UPDATED`, `.CANCELLED`,
   `.SUSPENDED`, `.EXPIRED`, `.PAYMENT.FAILED` и `PAYMENT.SALE.COMPLETED`.
7. Запишите `PAYPAL_WEBHOOK_ID`. Укажите в `FRONTEND_URL` фактический адрес frontend.
   Перезапустите backend. Для Compose: `docker compose up -d --force-recreate backend`.
8. Войдите в OnlyCats как посетитель, выберите кота и нажмите «Вступить в клуб».
   На сайте PayPal используйте Personal Sandbox аккаунт, не аккаунт продавца.
9. После возврата сервер получает состояние подписки из PayPal. Доступ появляется
   только при ACTIVE, подтверждённом положительном платеже и будущем конце периода.
   При задержке используйте «Проверить ещё раз» или «Обновить статус» в кабинете.

Общий план используется для разных котов, но каждой паре пользователь–кот
соответствует отдельная PayPal-подписка. `custom_id` связывает её с локальной записью.
Переход по return URL сам по себе не подтверждает оплату.

Webhook сначала проверяется через PayPal API; затем приложение заново читает
авторитетное состояние подписки. Обработанные event ID сохраняются для повторных доставок.
Сбой провайдера возвращает ошибку, чтобы PayPal мог повторить уведомление.

Успешная симуляция не проверяет реальные ключи, доступность аккаунта, оплату в
браузере PayPal и доставку webhook по публичному HTTPS. Эти проверки выполняются
после настройки Sandbox.

Источники: [Subscriptions API](https://developer.paypal.com/docs/api/subscriptions/v1/),
[webhook verification](https://developer.paypal.com/api/rest/webhooks/rest/),
[subscription events](https://developer.paypal.com/subscriptions/webhooks).
