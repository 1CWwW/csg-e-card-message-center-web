import type { Component } from 'vue'

export interface AppMenuItem {
  path: string
  title: string
  description: string
  icon: Component
}
