from django.urls import path

from .views import CompareView, HealthView, ValidateView

urlpatterns = [
    path("health/", HealthView.as_view()),
    path("compare/<str:fmt>/", CompareView.as_view()),
    path("validate/<str:fmt>/", ValidateView.as_view()),
]
