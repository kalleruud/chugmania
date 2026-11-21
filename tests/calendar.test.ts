import CalendarManager from '@backend/src/managers/calendar.manager'
import { expect, test } from 'bun:test'
import assert from 'node:assert/strict'
import { createSession, createUser, login } from './utils'

test('exports attendee emails and responses without requesting replies', async () => {
  const admin = await login(createUser('calendar-admin', 'admin'))
  const accepted = createUser('calendar#accepted')
  const declined = createUser('calendar-declined')
  const tentative = createUser('calendar-tentative')
  const invalid = createUser('calendar invalid address')
  const session = await createSession(admin, [
    { user: accepted.id, response: 'yes' },
    { user: declined.id, response: 'no' },
    { user: tentative.id, response: 'maybe' },
    { user: invalid.id, response: 'yes' },
  ])

  const calendar = await CalendarManager.getAllSessionsCalendar(
    new URL('https://example.test')
  )
  const unfolded = calendar.replace(/\r\n[ \t]/g, '')
  const event = unfolded
    .split('BEGIN:VEVENT\r\n')
    .find(event => event.includes(`UID:${session.id}@chugmania\r\n`))

  expect(unfolded).not.toContain('\r\nMETHOD:')
  assert(event, 'Expected the session in the calendar')
  const attendees = event
    .split('\r\n')
    .filter(line => line.startsWith('ATTENDEE;'))
  const expectedAttendees = [
    {
      name: accepted.firstName,
      status: 'ACCEPTED',
      address: 'calendar%23accepted@example.test',
    },
    { name: declined.firstName, status: 'DECLINED', address: declined.email },
    {
      name: tentative.firstName,
      status: 'TENTATIVE',
      address: tentative.email,
    },
  ]

  expect(attendees).toHaveLength(3)
  for (const { name, status, address } of expectedAttendees) {
    const attendee = attendees.find(line => line.endsWith(`:mailto:${address}`))
    expect(attendee).toContain(`PARTSTAT="${status}";CN="${name}"`)
    expect(attendee).toContain(';RSVP=FALSE;')
  }
})
