/**
 * Quiz decks, hand-authored alongside the glossary.
 *
 * Every question carries `term`, the slug of the glossary entry it is drawn
 * from, and quiz.test.ts asserts that slug exists. That coupling is the point:
 * the reviewed draft of this content defined chromatic number using "connected"
 * in one place and "adjacent" in the other, so the site would have contradicted
 * itself. One source, checked mechanically.
 *
 * Distractors are the part that needs care, and three in the reviewed draft were
 * accidentally correct or nearly so. Each near-miss below carries a comment,
 * because the natural "improvement" to several of them reintroduces the bug.
 *
 * Two questions from that draft are deliberately absent. They asked about this
 * application rather than about mathematics — one made an unverified claim about
 * a cryptographic primitive, and the other's designated correct answer was
 * itself false ("rule-based, so it can't go stale" is an absolute that does not
 * hold). A quiz teaches its answers, so a wrong answer is worse than no question.
 */

export const DECKS = [
  {
    slug: 'foundations',
    title: 'Foundations and logic',
    blurb:
      'What proof, independence and undecidability actually mean, and why three of those words get used for two different things.',
    questions: [
      {
        q: 'What distinguishes a conjecture from a theorem?',
        options: [
          'A conjecture is shorter',
          'A conjecture has not been proved',
          'A conjecture is known to be false',
          'A conjecture has no counterexample',
        ],
        answer: 1,
        why: 'A conjecture is a precisely stated claim awaiting proof or disproof. It is not a weaker kind of theorem, and it carries no guarantee: conjectures are regularly disproved after large amounts of supporting evidence.',
        term: 'conjecture',
      },
      {
        q: 'How many counterexamples are needed to disprove a universal claim?',
        options: [
          'One',
          'Infinitely many',
          'A majority of the cases',
          'None, because disproof needs a general argument',
        ],
        answer: 0,
        why: 'This asymmetry is why numerical evidence never settles a universal claim: proving it requires an argument covering every case, refuting it requires exactly one case.',
        term: 'counterexample',
      },
      {
        q: 'Gödel’s first incompleteness theorem applies to a formal system that is strong enough to express arithmetic and is also',
        options: [
          'finite',
          'consistent and effectively axiomatised',
          'complete',
          'decidable',
        ],
        // "complete" is the conclusion's negation, not a hypothesis, so it cannot
        // be a requirement. Both conditions in the answer are load-bearing: an
        // inconsistent system proves everything, and true arithmetic is complete
        // precisely because its axioms are not algorithmically listable.
        answer: 1,
        why: 'Consistency is required because an inconsistent system proves everything, including every true statement. Effective axiomatisation is required because true arithmetic is complete and escapes the theorem only by having no listable axioms.',
        term: 'godels-incompleteness-theorems',
      },
      {
        q: 'What does it mean that the continuum hypothesis is independent of ZFC?',
        options: [
          'It is false',
          'Neither it nor its negation can be proved from ZFC',
          'It is unproved but expected to be true',
          'No algorithm can decide it',
        ],
        // The last option is the other sense of "undecidable" and is deliberately
        // present: conflating the computability sense with the logical one is the
        // most common confusion about this result.
        answer: 1,
        why: 'Gödel showed in 1940 it cannot be disproved from ZFC and Cohen showed in 1963 it cannot be proved. That is a definitive answer about what those axioms decide, which is why it is not an open problem in the usual sense.',
        term: 'continuum-hypothesis',
      },
      {
        q: 'Two sets have the same cardinality when',
        options: [
          'they contain the same elements',
          'their elements can be matched one to one with none left over',
          'they are both infinite',
          'one is contained in the other',
        ],
        answer: 1,
        why: 'This criterion reproduces counting for finite sets and produces genuinely different sizes of infinity for infinite ones. It also makes some sets the same size as their own proper subsets, which is the defining oddity of the infinite.',
        term: 'cardinality',
      },
      {
        q: 'Why does the axiom of choice have no content for finite collections?',
        options: [
          'Finite sets are countable',
          'The choices can be made one at a time by induction',
          'The axiom applies only to sets of real numbers',
          'Finite sets have no proper subsets',
        ],
        // "Finite sets can be well-ordered without choice" is also true and was
        // rejected as a distractor for exactly that reason. The stated answer is
        // the reason; a second true statement would make the question ill-posed.
        answer: 1,
        why: 'For finitely many nonempty sets, induction produces the selection with no extra assumption. The entire content of the axiom is the infinite case, and specifically the case where no rule for choosing is available.',
        term: 'axiom-of-choice',
      },
      {
        q: 'A statement true of the natural numbers but unprovable in a given consistent system shows that the system is',
        options: ['inconsistent', 'incomplete', 'meaningless', 'unfounded'],
        answer: 1,
        why: 'Incompleteness is exactly this: a true statement the system cannot reach. It says nothing about the system being wrong, and adding the statement as a new axiom simply produces a new system with the same property.',
        term: 'godels-incompleteness-theorems',
      },
    ],
  },

  {
    slug: 'number-theory',
    title: 'Number theory',
    blurb:
      'Primes, perfect numbers, and the exact statements of Collatz, Goldbach and abc — including the conditions that are usually dropped.',
    questions: [
      {
        q: 'Why is 1 excluded from the prime numbers?',
        options: [
          'It is too small to be useful',
          'So that factorisation into primes is unique',
          'It is not an integer',
          'It has no divisors',
        ],
        answer: 1,
        why: 'If 1 counted as prime, every number would have infinitely many prime factorisations. The exclusion is a convention chosen to make the fundamental theorem of arithmetic true.',
        term: 'prime-number',
      },
      {
        q: 'Goldbach’s conjecture states that every even integer greater than 2 is',
        options: [
          'a sum of two primes',
          'a product of two primes',
          'a difference of two primes',
          'a sum of three primes',
        ],
        // The last option is the weak form's shape but is false as stated for
        // even numbers: 4 cannot be written as a sum of three primes.
        answer: 0,
        why: 'This is the binary or strong form and it remains open. The weak form, that every odd number above 5 is a sum of three primes, was proved by Helfgott in 2013.',
        term: 'goldbach-conjecture',
      },
      {
        q: 'In the Collatz rule, an odd number n is replaced by',
        options: ['n / 2', '3n + 1', 'n − 1', '3n'],
        answer: 1,
        why: 'Even numbers are halved and odd numbers become 3n + 1. The conjecture is that iterating this always reaches 1.',
        term: 'collatz-conjecture',
      },
      {
        q: 'Over which numbers is the Collatz conjecture stated?',
        options: ['All integers', 'The positive integers', 'The rationals', 'The primes'],
        answer: 1,
        why: 'The restriction is essential rather than tidiness. Over all integers the claim is false: −1 → −2 → −1 cycles forever, −5 enters a five-step cycle, and 0 maps to itself.',
        term: 'collatz-conjecture',
      },
      {
        q: 'A perfect number is equal to',
        options: [
          'the product of its divisors',
          'the sum of its proper divisors',
          'its own square root',
          'the sum of all its divisors',
        ],
        // Two traps live here. The first option must say "divisors", not "proper
        // divisors": 1 × 2 × 3 = 6, so the "improved" wording is accidentally
        // correct. And "twice its largest proper divisor" was rejected outright
        // as a distractor, because for any perfect number that is n/2 × 2 = n.
        answer: 1,
        why: 'The proper divisors are the positive divisors strictly below the number itself: 6 = 1 + 2 + 3. Whether any odd perfect number exists is open and has been for over two thousand years.',
        term: 'perfect-number',
      },
      {
        q: 'For two numbers to be amicable, they must be',
        options: ['distinct', 'both even', 'both prime', 'consecutive'],
        answer: 0,
        why: 'Without distinctness every perfect number would pair with itself and the definition would collapse into the previous one. The smallest genuine pair is 220 and 284.',
        term: 'amicable-numbers',
      },
      {
        q: 'The Riemann hypothesis is a claim about which zeros of the zeta function?',
        options: [
          'All of them',
          'The trivial zeros',
          'The nontrivial zeros',
          'The zeros of the gamma function',
        ],
        answer: 2,
        why: 'The trivial zeros are the negative even integers and are not at issue. The hypothesis says every nontrivial zero has real part exactly 1/2.',
        term: 'riemann-hypothesis',
      },
      {
        q: 'The trivial zeros of the Riemann zeta function are',
        options: [
          'the negative even integers',
          'the prime numbers',
          'the points with real part 1/2',
          'the negative odd integers',
        ],
        answer: 0,
        why: 'They arise from the functional equation, which is also what distinguishes the line with real part 1/2 by reflecting the plane about it.',
        term: 'riemann-zeta-function',
      },
      {
        q: 'In the abc conjecture, rad(abc) denotes',
        options: [
          'the sum a + b + c',
          'the product of the distinct primes dividing abc',
          'the radius of convergence',
          'the largest prime factor of abc',
        ],
        answer: 1,
        why: 'The radical discards exponents entirely, which is the whole content of the conjecture: a sum of numbers built from few distinct primes cannot itself have many repeated ones.',
        term: 'abc-conjecture',
      },
      {
        q: 'The abc conjecture requires the integers a, b and c to be',
        options: ['prime', 'coprime', 'even', 'consecutive'],
        answer: 1,
        why: 'Without coprimality the statement is false immediately. It is the condition most often dropped when the conjecture is stated informally.',
        term: 'abc-conjecture',
      },
    ],
  },

  {
    slug: 'geometry-topology',
    title: 'Geometry and topology',
    blurb: 'Deformation, dimension, holes and knots, and what "the same shape" is allowed to mean.',
    questions: [
      {
        q: 'Topology treats two shapes as the same when one can be turned into the other by',
        options: [
          'rotating it',
          'stretching and bending, without tearing or gluing',
          'cutting it apart and rejoining it',
          'scaling it uniformly',
        ],
        answer: 1,
        why: 'Topology deliberately forgets distance and angle. A coffee cup and a doughnut are the same because each has one hole; a sphere is different because it has none.',
        term: 'topology',
      },
      {
        q: 'Every point of a manifold has a neighbourhood resembling Euclidean space of',
        options: [
          'any dimension, which may vary by region',
          'one fixed dimension',
          'dimension three',
          'dimension two',
        ],
        answer: 1,
        why: 'The fixed dimension is part of the definition. A space that is two-dimensional in one region and three-dimensional in another satisfies the local condition and is not a manifold.',
        term: 'manifold',
      },
      {
        q: 'The genus of a torus is',
        options: ['0', '1', '2', 'undefined'],
        answer: 1,
        why: 'Genus counts holes, and it classifies closed orientable surfaces completely: two are topologically identical exactly when their genus agrees.',
        term: 'genus',
      },
      {
        q: 'For any convex polyhedron, vertices minus edges plus faces equals',
        options: ['0', '1', '2', 'the number of faces'],
        answer: 2,
        why: 'Every convex polyhedron is topologically a sphere, so the quantity belongs to the shape rather than the subdivision. A torus gives 0 instead.',
        term: 'euler-characteristic',
      },
      {
        q: 'Knot theory studies loops that are',
        options: [
          'open, with two free ends',
          'closed, with the ends joined',
          'confined to a plane',
          'perfect circles',
        ],
        answer: 1,
        why: 'An open piece of string can always be untangled, so the mathematics only becomes interesting once the ends are joined.',
        term: 'knot-theory',
      },
      {
        q: 'To prove two knots are genuinely different, you need',
        options: [
          'to fail to find a deformation between them',
          'an invariant that deformation cannot change',
          'a drawing of each on paper',
          'a count of the crossings in one drawing',
        ],
        // The last option is a near-miss kept deliberately: the MINIMAL crossing
        // number is an invariant, but the count in one particular drawing is not,
        // which is precisely the distinction being tested.
        answer: 1,
        why: 'Failing to find a deformation proves nothing, since you may simply not have found it. An invariant is a quantity preserved by every deformation, so two knots differing in one cannot be the same knot.',
        term: 'knot-theory',
      },
    ],
  },

  {
    slug: 'graphs-combinatorics',
    title: 'Graph theory and combinatorics',
    blurb: 'Colouring, planarity, paths, and the difference between adjacent and connected.',
    questions: [
      {
        q: 'A graph’s chromatic number is the smallest number of colours such that no two ___ vertices share a colour.',
        options: ['connected', 'adjacent', 'distant', 'labelled'],
        answer: 1,
        why: 'Adjacent means joined by an edge; connected means joined by some path. Under the connected reading the answer for any connected graph would just be its vertex count — a path on five vertices would give 5 instead of the correct 2.',
        term: 'chromatic-number',
      },
      {
        q: 'The four colour theorem states that four colours always suffice for',
        options: ['every graph', 'planar graphs', 'trees', 'complete graphs'],
        // Trees need only 2 and complete graphs need n, so neither is a correct
        // answer to "four colours always suffice" as a characterisation.
        answer: 1,
        why: 'It applies to graphs drawable in the plane without crossing edges, which is what makes it a statement about maps. Graphs in general need arbitrarily many colours.',
        term: 'planar-graph',
      },
      {
        q: 'A graph is planar when',
        options: [
          'some drawing of it has no crossing edges',
          'every drawing of it has no crossing edges',
          'it contains no cycles',
          'it has at most four vertices',
        ],
        answer: 0,
        why: 'Planarity is a property of the graph, not of a particular picture. A planar graph is usually drawn with crossings; what matters is that a crossing-free drawing exists.',
        term: 'planar-graph',
      },
      {
        q: 'If more items than containers are placed into containers, at least one container must hold two or more. Which principle states this?',
        options: [
          'The pigeonhole principle',
          'Ramsey’s theorem',
          'The axiom of choice',
          'Euler’s formula',
        ],
        // Reworded from a draft that asked "what must happen" and then offered
        // four principle names, so no option answered the question asked.
        answer: 0,
        why: 'The strict inequality does all the work and no finiteness assumption is needed. Despite being immediate, it underpins a large number of proofs that show something exists without indicating where.',
        term: 'pigeonhole-principle',
      },
      {
        q: 'A Hamiltonian path visits every',
        options: ['edge exactly once', 'vertex exactly once', 'face exactly once', 'cycle exactly once'],
        answer: 1,
        why: 'The path that visits every edge once is Eulerian instead, and the two behave completely differently: Eulerian paths have a simple degree criterion checkable in linear time.',
        term: 'hamiltonian-path',
      },
      {
        q: 'Deciding whether a graph has a Hamiltonian path is',
        options: ['solvable in linear time', 'NP-complete', 'undecidable', 'trivial'],
        answer: 1,
        why: 'This is the standard contrast with Eulerian paths, which are easy. Two problems that sound alike sit on opposite sides of the tractability line.',
        term: 'hamiltonian-path',
      },
    ],
  },

  {
    slug: 'computation',
    title: 'Computation and complexity',
    blurb: 'P, NP, completeness, and the two different things "undecidable" is used to mean.',
    questions: [
      {
        q: 'P versus NP asks whether every problem whose yes-instances can be verified quickly can also be',
        options: ['verified slowly', 'decided quickly', 'written down', 'reduced to another problem'],
        answer: 1,
        why: 'The asymmetry is deliberate: NP concerns verifying yes-instances from a certificate. Whether no-instances are equally verifiable is the separate open question of NP versus co-NP.',
        term: 'p-versus-np',
      },
      {
        q: 'In complexity theory, "quickly" means',
        options: ['in under one second', 'in polynomial time', 'in constant time', 'in linear time'],
        answer: 1,
        why: 'The identification of polynomial time with efficiency is a convention rather than a fact — an algorithm running in n¹⁰⁰ steps is polynomial and useless. It earns its place because the class does not change under reasonable changes of machine model.',
        term: 'polynomial-time',
      },
      {
        q: 'A problem is NP-complete when it lies in NP and',
        options: [
          'has no known algorithm',
          'every problem in NP reduces to it in polynomial time',
          'is undecidable',
          'provably requires exponential time',
        ],
        // The last option is false and is the point: whether NP-complete problems
        // require exponential time is exactly the open question.
        answer: 1,
        why: 'That reduction is what makes the class tractable to reason about. Nothing is known to require exponential time here; if it were, P versus NP would be settled.',
        term: 'np-complete',
      },
      {
        q: 'A polynomial-time algorithm for a single NP-complete problem would',
        options: ['prove P = NP', 'prove P ≠ NP', 'change nothing', 'prove the problem undecidable'],
        answer: 0,
        why: 'Every NP problem reduces to it in polynomial time, so one fast algorithm would give fast algorithms for all of them. This is why thousands of unrelated problems stand or fall together.',
        term: 'np-complete',
      },
      {
        q: 'In computability, a problem is undecidable when',
        options: [
          'nobody has solved it yet',
          'no algorithm always halts with a correct answer',
          'it is extremely difficult',
          'it has no answer',
        ],
        // The last option is false and tempting: each input has an answer, and
        // the failure is that no algorithm computes it.
        answer: 1,
        why: 'Each input still has a correct answer. What is impossible is an algorithm producing it for every input. This is a different notion from a statement being undecidable in a theory, which is about axioms rather than algorithms.',
        term: 'undecidability',
      },
      {
        q: 'A decision problem is one whose answer for each input is',
        options: ['a number', 'yes or no', 'a set', 'a proof'],
        answer: 1,
        why: 'Complexity classes such as P and NP are defined over decision problems, which is why statements about them are phrased that way. It is rarely a real restriction, since a search problem can usually be recast as one.',
        term: 'decision-problem',
      },
    ],
  },

  {
    slug: 'millennium',
    title: 'Millennium Prize Problems',
    blurb: 'The seven problems named by the Clay Mathematics Institute in 2000, and the one that has been settled.',
    questions: [
      {
        q: 'How many problems did the Clay Mathematics Institute name as Millennium Prize Problems in 2000?',
        options: ['5', '6', '7', '10'],
        // The stem names the announcement deliberately. A bare "how many are
        // there?" admits 6 as the alternate reading — the number still unsolved —
        // which punishes the better-informed reader.
        answer: 2,
        why: 'Seven were named in May 2000, each carrying a one million dollar prize. Note that six is also a true answer to a differently worded question, since six of the seven are still open, which is why this one names the announcement.',
        term: 'poincare-conjecture',
      },
      {
        q: 'How many of them remain unsolved?',
        options: ['5', '6', '7', '0'],
        answer: 1,
        why: 'Six remain open. Only the Poincaré conjecture has been settled.',
        term: 'poincare-conjecture',
      },
      {
        q: 'Which Millennium Prize Problem has been solved?',
        options: [
          'The Riemann hypothesis',
          'The Hodge conjecture',
          'The Poincaré conjecture',
          'P versus NP',
        ],
        answer: 2,
        why: 'Perelman proved it in preprints of 2002 and 2003 using Hamilton’s Ricci flow, and verification was complete by 2006.',
        term: 'poincare-conjecture',
      },
      {
        q: 'Who proved the Poincaré conjecture?',
        options: ['Andrew Wiles', 'Grigori Perelman', 'Terence Tao', 'Yitang Zhang'],
        answer: 1,
        why: 'Wiles proved Fermat’s Last Theorem, and Zhang proved that infinitely many prime pairs differ by a bounded amount. Neither is this problem.',
        term: 'poincare-conjecture',
      },
      {
        q: 'What became of the Millennium Prize for that proof?',
        options: [
          'It was never awarded',
          'It was awarded and declined',
          'It was split between two mathematicians',
          'It is still unclaimed pending review',
        ],
        // The first and last options are the common misreadings and are both
        // false: the prize was awarded in 2010. Refusing it is not the same as
        // it never being offered, and the problem is not still under review.
        answer: 1,
        why: 'The Clay Institute awarded the prize in 2010 and Perelman declined it. The problem is solved and the prize was awarded; it was simply refused.',
        term: 'poincare-conjecture',
      },
      {
        q: 'Which Millennium problem concerns the equations of fluid motion?',
        options: [
          'Yang–Mills existence and mass gap',
          'Navier–Stokes existence and smoothness',
          'The Hodge conjecture',
          'Birch and Swinnerton-Dyer',
        ],
        answer: 1,
        why: 'The problem asks whether smooth solutions always exist for the three-dimensional Navier–Stokes equations, or whether they can break down in finite time.',
        term: 'manifold',
      },
      {
        q: 'The Birch and Swinnerton-Dyer conjecture concerns',
        options: ['prime gaps', 'elliptic curves', 'knot invariants', 'graph colouring'],
        answer: 1,
        why: 'It relates the number of rational points on an elliptic curve to the behaviour of an associated L-function, linking an arithmetic count to an analytic object.',
        term: 'elliptic-curve',
      },
    ],
  },
];

/**
 * Rotates a question's options so the correct answer lands at `target`.
 *
 * Authoring order is natural order: the correct statement tends to get written
 * second, right after the most obvious wrong one. Left alone that produced 31 of
 * 42 answers at position B and none at D, so guessing B scored 74% without
 * knowing any mathematics. That is a defect in the instrument, not a nitpick.
 *
 * The rotation is applied when pages are generated, deriving `target` from the
 * question's index, so the distribution is exactly uniform and identical on
 * every build. Shuffling with Math.random would balance it too, and would make
 * the build non-reproducible and the answer key different on every deploy.
 *
 * Rotation rather than a general permutation keeps neighbouring options
 * adjacent, which matters where two options are deliberately near-misses of each
 * other.
 */
export function balancedOptions(question, target) {
  const n = question.options.length;
  const shift = (((target - question.answer) % n) + n) % n;
  const options = new Array(n);
  question.options.forEach((opt, i) => {
    options[(i + shift) % n] = opt;
  });
  return { options, answer: (question.answer + shift) % n };
}
