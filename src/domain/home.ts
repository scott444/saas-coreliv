export interface Home {
  id: string
  name: string
  address: string
}

export type HomeInput = Omit<Home, 'id'>
