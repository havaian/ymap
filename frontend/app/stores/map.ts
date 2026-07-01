// app/stores/map.ts
import { defineStore } from 'pinia'

// Map UI state. Filled out in Этап 4 (MapCanvas.client.vue, ObjectPopup). Kept minimal
// here so the store exists for the scaffold without carrying unused map logic.
export const useMapStore = defineStore('map', {
  state: () => ({
    selectedRegionCode: null as number | null,
    selectedObjectId: null as string | null,
    popupOpen: false,
  }),
  actions: {
    selectRegion(code: number | null) {
      this.selectedRegionCode = code
    },
    openObject(id: string) {
      this.selectedObjectId = id
      this.popupOpen = true
    },
    closePopup() {
      this.popupOpen = false
      this.selectedObjectId = null
    },
  },
})
