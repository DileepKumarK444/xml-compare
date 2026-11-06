from django.urls import path

from .views import CompareView, HealthView

urlpatterns = [
    path("health/", HealthView.as_view()),
    path("compare/<str:fmt>/", CompareView.as_view()),
]
