import type { NextRequest } from 'next/server'

const VPIC_BASE_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles'
const currentYear = new Date().getFullYear()

type VpicMake = {
  Make_ID: number
  Make_Name: string
}

type VpicModel = {
  Model_ID: number
  Model_Name: string
}

type VpicResponse<T> = {
  Results: T[]
}

export const revalidate = 86400

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type')

  try {
    if (type === 'makes') {
      const response = await fetch(`${VPIC_BASE_URL}/GetAllMakes?format=json`, {
        next: { revalidate },
      })
      if (!response.ok) throw new Error('Vehicle makes are unavailable.')

      const data = await response.json() as VpicResponse<VpicMake>
      const makes = data.Results
        .filter(make => make.Make_ID && make.Make_Name)
        .sort((first, second) => first.Make_Name.localeCompare(second.Make_Name))
        .map(make => ({ id: String(make.Make_ID), name: make.Make_Name }))

      return Response.json({ makes })
    }

    if (type === 'models') {
      const makeId = request.nextUrl.searchParams.get('makeId')
      const year = Number(request.nextUrl.searchParams.get('year'))
      if (!makeId || !/^\d+$/.test(makeId) || !Number.isInteger(year) || year < 1900 || year > currentYear) {
        return Response.json({ error: 'Choose a valid vehicle year and make.' }, { status: 400 })
      }

      const response = await fetch(`${VPIC_BASE_URL}/GetModelsForMakeIdYear/makeId/${makeId}/modelyear/${year}?format=json`, {
        next: { revalidate },
      })
      if (!response.ok) throw new Error('Vehicle models are unavailable.')

      const data = await response.json() as VpicResponse<VpicModel>
      const models = data.Results
        .filter(model => model.Model_ID && model.Model_Name)
        .sort((first, second) => first.Model_Name.localeCompare(second.Model_Name))
        .map(model => ({ id: String(model.Model_ID), name: model.Model_Name }))

      return Response.json({ models })
    }

    return Response.json({ error: 'Unsupported vehicle request.' }, { status: 400 })
  } catch {
    return Response.json({ error: 'Vehicle information is temporarily unavailable. Please try again.' }, { status: 503 })
  }
}