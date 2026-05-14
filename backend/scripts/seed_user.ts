import { getDb } from '@/database/db'
import User from '@/database/user'
import Team from '@/database/team'
import bcrypt from 'bcryptjs'

async function seedUser(): Promise<void> {
  getDb()
  const email = process.env.EMAIL
  const password = process.env.PASSWORD

  if (!email || !password) {
    throw new Error('EMAIL and PASSWORD are required')
  }

  const existing = await User.findOne({ where: { email } })
  if (existing) {
    throw new Error(`User already exists: ${email}`)
    return
  }

  const team = await Team.create({
    display_name: 'Default',
    settings: {},
  })

  const password_hash = await bcrypt.hash(password, 10)

  await User.create({
    email,
    display_name: 'Admin',
    role: 'admin',
    status: 'registered',
    settings: {},
    is_bot: false,
    team_id: team.id,
    password_hash,
  })

  console.log(`Seeded user: ${email} (password: ${password})`)

  return;
}

seedUser()
