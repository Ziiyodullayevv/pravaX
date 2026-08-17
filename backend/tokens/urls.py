from django.urls import path

from .views import (
    DailyBonusView,
    SubscribePlanView,
    SubscriptionView,
    TransactionHistoryView,
    WalletView,
)

urlpatterns = [
    path('balance/',           WalletView.as_view(),           name='token-balance'),
    path('history/',           TransactionHistoryView.as_view(), name='token-history'),
    path('subscription/',      SubscriptionView.as_view(),      name='subscription'),
    path('subscription/buy/',  SubscribePlanView.as_view(),     name='subscription-buy'),
    path('subscription/daily/', DailyBonusView.as_view(),       name='daily-bonus'),
]
