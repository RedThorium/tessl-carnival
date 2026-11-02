# Ring Toss

Land your five rings over the bottles scattered on the table.

## How to play

- 15 bottles stand at random spots on the table, drawn at an isometric slant so
  you see their sides and the tops of their caps. Each round scatters them again.
  A bottle's spot on the table is the middle of its base.
- The aim line swings left and right, once every 3 seconds. Click once to lock
  in the direction.
- A ring marker then moves along the line from the front of the table to the back
  and returns, once every 3 seconds. Click again to lock in the distance and toss the ring.
- You have 5 rings. The game ends when the fifth ring lands.
- Click again on the game over screen to play another round.

## Scoring

A ring scores 1 point when it lands over a bottle: its middle is within 22 px of
the bottle's middle. A bottle takes one ring, so a second ring on the same bottle
scores nothing. The best score is 5.

Your final score is saved to the carnival's score board when the game ends.

## Files

- `game.ts`: the game logic (`createState`, `placeBottles`, `lockIn`, `step`,
  `bottleUnder`, `backToFront`) and the `ringToss` entry, the default export the midway finds.
- `game.test.ts`: tests for the game logic.
