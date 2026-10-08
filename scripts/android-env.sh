#!/usr/bin/env sh
# scripts/android-env.sh — entorno para el build Android (Capacitor, fase C0).
#
# Uso: source scripts/android-env.sh  (o `. scripts/android-env.sh`)
#
# - ANDROID_HOME/ANDROID_SDK_ROOT: SDK instalado en espacio de usuario
#   (~/Android/Sdk): platform-tools (adb), platforms 35+36, build-tools 35.
# - JAVA_HOME: JDK 21 de sdkman (Capacitor 8 compila con release 21; AGP
#   8.13 + Gradle 8.14 corren sobre 21). Ni el Java 26 del sistema ni el 17
#   sirven como runner: se fija aquí sin tocar el default del sistema.
#   Queda JDK 17 instalado como fallback (era el runner inicial).
# - <sdk>/cmdline-tools/latest/bin a PATH (sdkmanager) por comodidad.
#
# Este archivo no se versiona con secretos: solo rutas locales.

ANDROID_SDK_DIR="$HOME/Android/Sdk"
SDKMAN_JAVA21="$HOME/.sdkman/candidates/java/21.0.12+1.1-tem"
SDKMAN_JAVA17="$HOME/.sdkman/candidates/java/17.0.20-tem"

if [ -d "$ANDROID_SDK_DIR" ]; then
  export ANDROID_HOME="$ANDROID_SDK_DIR"
  export ANDROID_SDK_ROOT="$ANDROID_SDK_DIR"
  case ":$PATH:" in
    *":$ANDROID_SDK_DIR/platform-tools:"*) ;;
    *) export PATH="$ANDROID_SDK_DIR/platform-tools:$PATH" ;;
  esac
  case ":$PATH:" in
    *":$ANDROID_SDK_DIR/cmdline-tools/latest/bin:"*) ;;
    *) export PATH="$ANDROID_SDK_DIR/cmdline-tools/latest/bin:$PATH" ;;
  esac
else
  echo "android-env: no existe $ANDROID_SDK_DIR (ver PLAN.md Fase 2, C0)" >&2
fi

if [ -d "$SDKMAN_JAVA21" ]; then
  export JAVA_HOME="$SDKMAN_JAVA21"
  case ":$PATH:" in
    *":$SDKMAN_JAVA21/bin:"*) ;;
    *) export PATH="$SDKMAN_JAVA21/bin:$PATH" ;;
  esac
elif [ -d "$SDKMAN_JAVA17" ]; then
  export JAVA_HOME="$SDKMAN_JAVA17"
  case ":$PATH:" in
    *":$SDKMAN_JAVA17/bin:"*) ;;
    *) export PATH="$SDKMAN_JAVA17/bin:$PATH" ;;
  esac
else
  echo "android-env: sin JDK 21/17 en ~/.sdkman (sdk install java …)" >&2
fi
