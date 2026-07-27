/**
 * Glossary terms, hand-authored.
 *
 * This is the one dataset in this project that is written rather than generated,
 * and the reason is that no source for it exists. The problem dataset is parsed
 * from a Wikipedia article; there is no equivalent article of definitions to
 * parse, and auto-generating definitions from problem statements would be
 * fabrication — the statements are questions, not definitions, and 122 problems
 * have no statement at all.
 *
 * Plain ESM rather than TypeScript because both Vite and the Node build script
 * import it directly, and a .ts import from a .mjs script depends on Node's
 * type-stripping being enabled. There is nothing to gain from that risk here.
 *
 * Every entry carries a `note`. That is deliberate and is the difference between
 * this and a dictionary: the note is where the precision lives — the quantifier
 * that makes the definition true, the condition people omit, the second sense of
 * a word used two ways. A page carrying only a one-line definition would be the
 * thin content this project has refused twice already.
 *
 * `problems` are hand-checked ids from problems.generated.json. They are NOT
 * derived by string matching: "prime" appears in 23 problem titles and "number"
 * in 30, so a matcher would produce confident nonsense. glossary.test.ts asserts
 * every id here still exists in the dataset.
 */

export const CATEGORIES = [
  'Foundations and logic',
  'Set theory',
  'Number theory',
  'Analysis',
  'Geometry and topology',
  'Graph theory and combinatorics',
  'Theoretical computer science',
  'Dynamical systems',
];

export const TERMS = [
  // ---------------------------------------------------------- foundations
  {
    slug: 'conjecture',
    term: 'Conjecture',
    category: 'Foundations and logic',
    definition:
      'A precisely stated mathematical claim that is expected to be true but has neither been proved nor disproved.',
    note: 'The word carries no guarantee. Conjectures are regularly disproved, sometimes after enormous amounts of supporting evidence: Polya’s conjecture survived checks up to hundreds of millions before a counterexample was found. A conjecture is a question with an opinion attached, not a weaker kind of theorem.',
    seeAlso: ['theorem', 'counterexample', 'open-problem'],
    problems: [],
  },
  {
    slug: 'theorem',
    term: 'Theorem',
    category: 'Foundations and logic',
    definition:
      'A statement established by a valid deductive proof from stated axioms together with previously proved results.',
    note: 'Theoremhood is relative to an axiom system, not absolute. A statement can be a theorem of one system and independent of a weaker one — the well-ordering theorem is a theorem of ZFC but not of ZF alone. Saying a theorem is "proved true" quietly conflates provability with truth, which is exactly the distinction Gödel’s theorems turn on.',
    seeAlso: ['proof', 'axiom', 'independence', 'godels-incompleteness-theorems'],
    problems: [],
  },
  {
    slug: 'proof',
    term: 'Proof',
    category: 'Foundations and logic',
    definition:
      'A finite chain of deductive steps, each justified by an axiom or an already established result, that establishes a statement within a formal system.',
    note: 'A proof is checkable in principle by following its steps, which is what separates it from evidence. Numerical verification, however extensive, is not a proof: checking a claim for every case up to 10²⁰ says nothing about 10²⁰ + 1 unless an argument covers all cases at once.',
    seeAlso: ['theorem', 'counterexample', 'formal-system'],
    problems: [],
  },
  {
    slug: 'axiom',
    term: 'Axiom',
    category: 'Foundations and logic',
    definition:
      'A statement assumed without proof, taken as a starting point from which other results are derived.',
    note: 'Axioms are chosen, not discovered, and changing them changes what is provable. Euclidean and hyperbolic geometry differ by a single axiom about parallel lines, and both are internally consistent, so neither choice is the correct one — they simply describe different objects. "Self-evident" is a historical description of what people hoped axioms would be, not a requirement of one; the axiom of choice is accepted despite consequences almost nobody finds obvious.',
    seeAlso: ['theorem', 'formal-system', 'axiom-of-choice', 'independence'],
    problems: [],
  },
  {
    slug: 'counterexample',
    term: 'Counterexample',
    category: 'Foundations and logic',
    definition:
      'A single case satisfying a claim’s hypotheses but failing its conclusion, which is enough to disprove the claim outright.',
    note: 'The asymmetry is the point: proving a universal statement requires an argument covering every case, while refuting it requires exactly one. This is why a conjecture can accumulate overwhelming numerical support and still be false, and why the smallest known counterexample to a statement is sometimes astronomically large.',
    seeAlso: ['conjecture', 'proof'],
    problems: [],
  },
  {
    slug: 'open-problem',
    term: 'Open problem',
    category: 'Foundations and logic',
    definition:
      'A question that has not been settled: no accepted proof, no disproof, and for questions that are not yes-or-no, no known solution.',
    note: 'Open is not the same as unsettled-in-principle. The continuum hypothesis is not open in this sense — it is proved independent of ZFC, which is itself a definitive answer about what those axioms can decide. A problem can also stop being open without anyone finding the answer, if it is shown that no answer exists.',
    seeAlso: ['conjecture', 'independence', 'undecidability'],
    problems: [],
  },
  {
    slug: 'independence',
    term: 'Independence',
    category: 'Foundations and logic',
    definition:
      'A statement is independent of an axiom system when neither it nor its negation can be proved from those axioms.',
    note: 'Independence is a positive result, not a failure. Showing a statement independent requires constructing models of the axioms in which it holds and models in which it fails — which is how Cohen settled the continuum hypothesis in 1963, and why that problem is closed rather than open.',
    seeAlso: ['axiom', 'continuum-hypothesis', 'godels-incompleteness-theorems', 'open-problem'],
    problems: [],
  },
  {
    slug: 'godels-incompleteness-theorems',
    term: 'Gödel’s incompleteness theorems',
    category: 'Foundations and logic',
    definition:
      'Two results of Kurt Gödel (1931). First: any consistent, effectively axiomatised formal system strong enough to express basic arithmetic contains statements true of the natural numbers that it cannot prove. Second: no such system can prove its own consistency.',
    note: 'Every condition is load-bearing. Consistency is required because an inconsistent system proves everything. Effective axiomatisation is required because true arithmetic — the set of all true statements about the naturals — is complete but has no algorithmically listable axioms. And the system must express enough arithmetic; simpler theories such as Presburger arithmetic are complete and decidable.',
    seeAlso: ['theorem', 'undecidability', 'formal-system', 'independence'],
    problems: [],
  },
  {
    slug: 'undecidability',
    term: 'Undecidability',
    category: 'Foundations and logic',
    definition:
      'In computability, the property of a decision problem for which no algorithm always halts with a correct answer. In logic, a statement is undecidable in a theory when neither it nor its negation is provable from its axioms.',
    note: 'These are two different notions sharing a word, and confusing them is common. The halting problem is undecidable in the first sense: no program can correctly decide, for all inputs, whether a given program halts. The continuum hypothesis is undecidable in the second sense, relative to ZFC. The first is about algorithms, the second about axioms.',
    seeAlso: ['decision-problem', 'independence', 'godels-incompleteness-theorems', 'algorithm'],
    problems: [],
  },
  {
    slug: 'formal-system',
    term: 'Formal system',
    category: 'Foundations and logic',
    definition:
      'A precisely specified language together with axioms and inference rules, in which proofs are finite objects that can be checked mechanically.',
    note: 'Formalising a system is what makes questions about mathematics itself answerable mathematically. You cannot ask whether a statement is provable until "provable" names something definite, which is precisely what a formal system supplies and what Gödel’s results then exploit. The trade is that working mathematicians almost never write formal proofs; ordinary proofs are arguments in natural language, understood to be formalisable in principle rather than actually formalised. Proof assistants such as Lean close that gap deliberately, at considerable cost in effort.',
    seeAlso: ['axiom', 'proof', 'godels-incompleteness-theorems'],
    problems: [],
  },

  // ------------------------------------------------------------ set theory
  {
    slug: 'set-theory',
    term: 'Set theory',
    category: 'Set theory',
    definition:
      'The study of sets as a foundation for mathematics, including infinite cardinal and ordinal numbers and the question of which statements a given axiom system can settle.',
    note: 'Modern set theory is far more than "collections of objects". Most of its work concerns the structure of infinities and independence results: which statements ZFC decides, and what happens when further axioms are assumed. The naive version collapsed — allowing any describable collection to be a set produces Russell’s paradox, from the set of all sets that do not contain themselves. ZFC’s axioms exist to permit the constructions mathematics needs while blocking that one.',
    seeAlso: ['cardinality', 'axiom-of-choice', 'continuum-hypothesis'],
    problems: [],
  },
  {
    slug: 'cardinality',
    term: 'Cardinality',
    category: 'Set theory',
    definition:
      'A measure of the size of a set. Two sets have the same cardinality when their elements can be matched one to one with none left over.',
    note: 'For finite sets this reproduces counting. For infinite sets it produces genuinely different sizes: Cantor showed the reals cannot be matched one to one with the integers, so some infinities are strictly larger than others. The one-to-one criterion also makes a set the same size as some of its proper subsets, which is the defining oddity of the infinite.',
    seeAlso: ['countable-set', 'continuum-hypothesis', 'set-theory'],
    problems: [],
  },
  {
    slug: 'countable-set',
    term: 'Countable set',
    category: 'Set theory',
    definition:
      'A set whose elements can be listed in a sequence indexed by the natural numbers, possibly terminating. Equivalently, a set no larger than the set of natural numbers.',
    note: 'Countability is less restrictive than it sounds. The rationals are countable despite being dense in the reals, and so are the algebraic numbers. The reals are not, which means almost every real number is transcendental even though exhibiting a specific one is hard.',
    seeAlso: ['cardinality', 'transcendental-number', 'continuum-hypothesis'],
    problems: [],
  },
  {
    slug: 'continuum-hypothesis',
    term: 'Continuum hypothesis',
    category: 'Set theory',
    definition:
      'The statement that no set has cardinality strictly between that of the natural numbers and that of the real numbers.',
    note: 'It is a statement, not a question, and it is settled in a specific sense: Gödel (1940) showed it cannot be disproved from ZFC, and Cohen (1963) showed it cannot be proved from ZFC. It is therefore independent of the standard axioms, which is why it is not listed as open here in the way an unproved conjecture is.',
    seeAlso: ['cardinality', 'independence', 'axiom-of-choice', 'countable-set'],
    problems: ['generalized-continuum-hypothesis'],
  },
  {
    slug: 'axiom-of-choice',
    term: 'Axiom of choice',
    category: 'Set theory',
    definition:
      'The assumption that for any collection of nonempty sets there is a function selecting exactly one element from each.',
    note: 'For finite collections this needs no axiom — it follows by induction. The entire content is in the infinite case, and specifically the case where no rule for choosing is available. It is independent of the other ZFC axioms, and it implies results many find counterintuitive, including the Banach–Tarski decomposition.',
    seeAlso: ['axiom', 'set-theory', 'independence'],
    problems: [],
  },

  // --------------------------------------------------------- number theory
  {
    slug: 'prime-number',
    term: 'Prime number',
    category: 'Number theory',
    definition:
      'A positive integer greater than 1 whose only positive divisors are 1 and itself, equivalently an integer with exactly two distinct positive divisors.',
    note: 'The exclusion of 1 is a convention with a reason: it makes factorisation into primes unique. If 1 counted, every number would have infinitely many factorisations. Note also that "divisible only by 1 and itself" is false read over all integers, since every prime p is also divisible by −1 and −p.',
    seeAlso: ['twin-prime', 'mersenne-prime', 'prime-number-theorem', 'goldbach-conjecture', 'modular-arithmetic'],
    problems: ['twin-prime', 'goldbach-conjecture'],
  },
  {
    slug: 'twin-prime',
    term: 'Twin prime',
    category: 'Number theory',
    definition:
      'A prime that differs by 2 from another prime. The two together, such as 11 and 13, are called a twin prime pair.',
    note: 'The twin prime conjecture asserts there are infinitely many such pairs and is open. Progress has been substantial without settling it: Zhang (2013) proved there are infinitely many prime pairs differing by at most some fixed bound, and collaborative work has since pushed that bound to 246. Getting it to 2 is the remaining problem.',
    seeAlso: ['prime-number', 'prime-number-theorem'],
    problems: ['twin-prime'],
  },
  {
    slug: 'mersenne-prime',
    term: 'Mersenne prime',
    category: 'Number theory',
    definition: 'A prime of the form 2ⁿ − 1 for some integer n.',
    note: 'If 2ⁿ − 1 is prime then n must itself be prime, but the converse fails — 2¹¹ − 1 = 2047 = 23 × 89. Mersenne primes dominate the record books because the Lucas–Lehmer test decides their primality far faster than general methods, not because they are unusually common. Whether infinitely many exist is open.',
    seeAlso: ['prime-number', 'perfect-number'],
    problems: ['mersenne-prime'],
  },
  {
    slug: 'perfect-number',
    term: 'Perfect number',
    category: 'Number theory',
    definition:
      'A positive integer equal to the sum of its proper divisors, meaning its positive divisors strictly less than itself. The smallest is 6 = 1 + 2 + 3.',
    note: 'Euclid and Euler together established that the even perfect numbers are exactly the numbers 2ⁿ⁻¹(2ⁿ − 1) where 2ⁿ − 1 is prime, tying them one-to-one to the Mersenne primes. Whether any odd perfect number exists is open and has been for over two millennia, with no example found below 10¹⁵⁰⁰.',
    seeAlso: ['amicable-numbers', 'mersenne-prime'],
    problems: ['odd-perfect-number'],
  },
  {
    slug: 'amicable-numbers',
    term: 'Amicable numbers',
    category: 'Number theory',
    definition:
      'A pair of distinct positive integers, each equal to the sum of the other’s proper divisors. The smallest pair is 220 and 284.',
    note: 'Distinctness is not decoration. Without it, every perfect number would pair with itself and the definition would swallow the previous entry. Whether infinitely many amicable pairs exist is open, as is whether any pair consists of one even and one odd number.',
    seeAlso: ['perfect-number'],
    problems: ['amicable-numbers'],
  },
  {
    slug: 'diophantine-equation',
    term: 'Diophantine equation',
    category: 'Number theory',
    definition:
      'A polynomial equation, or system of equations, with integer coefficients, for which integer solutions are sought.',
    note: 'Restricting to integers changes the problem completely: x² + y² = z² has a continuum of real solutions and a rich but discrete set of integer ones. Hilbert’s tenth problem asked for a general algorithm deciding whether such an equation has an integer solution; Matiyasevich completed a proof in 1970 that no such algorithm exists.',
    seeAlso: ['elliptic-curve', 'undecidability', 'abc-conjecture'],
    problems: [],
  },
  {
    slug: 'modular-arithmetic',
    term: 'Modular arithmetic',
    category: 'Number theory',
    definition:
      'Arithmetic in which numbers wrap around on reaching a fixed modulus n, so that a and b are treated as equal when n divides a − b.',
    note: 'This is the standard tool for proving something is impossible. Showing an equation has no solutions modulo some small n rules out integer solutions entirely, and often in a line. The converse does not hold: solvability modulo every n does not guarantee an integer solution, and the gap between the two is the subject of the local-global principle.',
    seeAlso: ['diophantine-equation', 'prime-number'],
    problems: [],
  },
  {
    slug: 'riemann-zeta-function',
    term: 'Riemann zeta function',
    category: 'Number theory',
    definition:
      'The function ζ(s) = ∑ 1/nˢ summed over positive integers n, defined by that series where it converges and extended to the rest of the complex plane by analytic continuation.',
    note: 'Its connection to the primes is the Euler product: ζ(s) also equals the product over all primes p of 1/(1 − p⁻ˢ). That identity is why a question about a complex-analytic function is a question about prime distribution. Note that "zeta function" names a whole family — Selberg, Ihara, dynamical — most of which have nothing to do with primes.',
    seeAlso: ['riemann-hypothesis', 'analytic-continuation', 'critical-line', 'prime-number-theorem'],
    problems: ['riemann-hypothesis'],
  },
  {
    slug: 'riemann-hypothesis',
    term: 'Riemann hypothesis',
    category: 'Number theory',
    definition:
      'The conjecture that every nontrivial zero of the Riemann zeta function has real part exactly 1/2.',
    note: 'The trivial zeros are the negative even integers −2, −4, −6, and so on; they come from the functional equation and are not at issue. The hypothesis is equivalent to a sharp bound on how far the count of primes below x can stray from the logarithmic integral, which is why it is described as being about the regularity of the primes. Billions of zeros have been computed and all lie on the critical line, which is evidence and not proof.',
    seeAlso: ['riemann-zeta-function', 'critical-line', 'prime-number-theorem', 'conjecture'],
    problems: ['riemann-hypothesis', 'generalized-riemann-hypothesis'],
  },
  {
    slug: 'prime-number-theorem',
    term: 'Prime number theorem',
    category: 'Number theory',
    definition:
      'The theorem that the number of primes not exceeding x is asymptotic to x / ln x, meaning the ratio of the two tends to 1 as x grows.',
    note: 'Asymptotic equality is weaker than it looks: the ratio tending to 1 permits the absolute difference to grow without bound, and it does. The logarithmic integral li(x) is a substantially better approximation than x / ln x, and how well it does is exactly what the Riemann hypothesis pins down.',
    seeAlso: ['prime-number', 'riemann-hypothesis', 'riemann-zeta-function'],
    problems: [],
  },
  {
    slug: 'goldbach-conjecture',
    term: 'Goldbach conjecture',
    category: 'Number theory',
    definition:
      'The conjecture that every even integer greater than 2 is a sum of two primes. The two primes need not be distinct, as in 4 = 2 + 2.',
    note: 'This is the binary or strong form and is open. The weak form — every odd number greater than 5 is a sum of three primes — was proved by Helfgott in 2013. Strong Goldbach implies weak Goldbach, so the harder statement remains the open one.',
    seeAlso: ['prime-number', 'conjecture'],
    problems: ['goldbach-conjecture', 'goldbach-s-weak-conjecture'],
  },
  {
    slug: 'collatz-conjecture',
    term: 'Collatz conjecture',
    category: 'Number theory',
    definition:
      'The conjecture that for every positive integer n, repeatedly applying the rule "halve n if it is even, otherwise replace it with 3n + 1" eventually reaches 1.',
    note: 'The restriction to positive integers is essential, not tidiness. Over all integers the claim is simply false: −1 → −2 → −1 cycles forever, as does −5 → −14 → −7 → −20 → −10 → −5, and 0 maps to itself. Verification has reached beyond 2⁶⁰ without a counterexample, which again is evidence rather than proof.',
    seeAlso: ['conjecture', 'orbit', 'counterexample'],
    problems: ['collatz-conjecture'],
  },
  {
    slug: 'abc-conjecture',
    term: 'abc conjecture',
    category: 'Number theory',
    definition:
      'For coprime positive integers with a + b = c, the conjecture that for every ε > 0 only finitely many such triples satisfy c > rad(abc)^(1+ε), where rad denotes the product of the distinct primes dividing abc.',
    note: 'Two conditions are routinely dropped and both are essential. Without coprimality the statement is false immediately. And the bound involves the radical, which discards exponents entirely — that is the whole content, since it says a sum of numbers with few distinct prime factors cannot itself have many repeated ones. Mochizuki claimed a proof in 2012; it has not achieved consensus acceptance.',
    seeAlso: ['diophantine-equation', 'prime-number', 'conjecture'],
    problems: ['abc-conjecture'],
  },
  {
    slug: 'elliptic-curve',
    term: 'Elliptic curve',
    category: 'Number theory',
    definition:
      'A smooth projective curve of genus 1 together with a chosen rational point on it. Concretely, the solutions of a nonsingular cubic such as y² = x³ + ax + b, plus a point at infinity.',
    note: 'A smooth plane cubic with no rational point on it is not an elliptic curve; the chosen base point is part of the definition. What makes these objects central is that their points form an abelian group under a geometric addition rule, which is what both arithmetic geometry and elliptic-curve cryptography exploit.',
    seeAlso: ['genus', 'diophantine-equation'],
    problems: ['birch-and-swinnerton-dyer-conjecture'],
  },

  // -------------------------------------------------------------- analysis
  {
    slug: 'analytic-continuation',
    term: 'Analytic continuation',
    category: 'Analysis',
    definition:
      'The extension of a complex function beyond the region where its original formula converges, to a larger domain on which it remains complex-differentiable.',
    note: 'The extension, where it exists, is unique — which is what makes it legitimate rather than arbitrary. This matters for the zeta function: ∑ 1/nˢ diverges for s = −1, yet ζ(−1) = −1/12 is a well-defined value of the continued function. That value is not the sum of the divergent series, and treating it as one is a common misreading.',
    seeAlso: ['riemann-zeta-function', 'critical-line'],
    problems: [],
  },
  {
    slug: 'critical-line',
    term: 'Critical line',
    category: 'Analysis',
    definition:
      'The vertical line in the complex plane consisting of numbers with real part 1/2, on which the Riemann hypothesis asserts all nontrivial zeta zeros lie.',
    note: 'It is distinguished by the functional equation, which relates ζ(s) to ζ(1 − s) and so reflects the plane about this line. Hardy proved in 1914 that infinitely many zeros lie on it; that is compatible with infinitely many lying off it, which is why the result does not settle the hypothesis.',
    seeAlso: ['riemann-hypothesis', 'riemann-zeta-function', 'analytic-continuation'],
    problems: ['riemann-hypothesis'],
  },
  {
    slug: 'transcendental-number',
    term: 'Transcendental number',
    category: 'Analysis',
    definition:
      'A real or complex number that is not a root of any nonzero polynomial with rational coefficients.',
    note: 'Almost every real number is transcendental, because the algebraic numbers are countable and the reals are not. Proving any specific number transcendental is nonetheless difficult: π and e are known to be, while whether π + e is transcendental — or even irrational — is open.',
    seeAlso: ['countable-set', 'cardinality'],
    problems: [],
  },

  // --------------------------------------------------- geometry & topology
  {
    slug: 'topology',
    term: 'Topology',
    category: 'Geometry and topology',
    definition:
      'The study of properties of a space preserved under continuous deformation — stretching and bending, but not tearing or gluing.',
    note: 'Topology deliberately forgets distance and angle, keeping only what survives deformation. A coffee cup and a doughnut are the same topologically because each has one hole; a sphere is different because it has none. What counts as "the same" is made precise by homeomorphism.',
    seeAlso: ['homeomorphism', 'manifold', 'genus', 'euler-characteristic', 'knot-theory'],
    problems: [],
  },
  {
    slug: 'homeomorphism',
    term: 'Homeomorphism',
    category: 'Geometry and topology',
    definition:
      'A continuous one-to-one correspondence between two spaces whose inverse is also continuous. Spaces related by one are topologically identical.',
    note: 'Requiring the inverse to be continuous is not redundant. The map wrapping a half-open interval around a circle is continuous and one-to-one onto the circle, but its inverse tears the circle apart, so the two are not homeomorphic — as they should not be.',
    seeAlso: ['topology', 'manifold'],
    problems: [],
  },
  {
    slug: 'manifold',
    term: 'Manifold',
    category: 'Geometry and topology',
    definition:
      'A space in which every point has a neighbourhood resembling ordinary n-dimensional Euclidean space, for one fixed n, and which is Hausdorff and second-countable.',
    note: 'The fixed dimension matters: a space that is two-dimensional in one region and three-dimensional in another is not a manifold. The two point-set conditions exclude pathologies such as the line with two origins and the long line, which satisfy the local condition and behave nothing like surfaces.',
    seeAlso: ['topology', 'homeomorphism', 'poincare-conjecture', 'genus'],
    problems: [],
  },
  {
    slug: 'genus',
    term: 'Genus',
    category: 'Geometry and topology',
    definition:
      'For a closed orientable surface, the number of holes: a sphere has genus 0, a torus genus 1, a two-holed torus genus 2.',
    note: 'Genus classifies closed orientable surfaces completely — two are homeomorphic exactly when their genus agrees, which is unusually clean for a topological invariant. It also connects to the Euler characteristic by χ = 2 − 2g, and it is the invariant that makes an elliptic curve "genus 1".',
    seeAlso: ['topology', 'euler-characteristic', 'elliptic-curve', 'manifold'],
    problems: [],
  },
  {
    slug: 'euler-characteristic',
    term: 'Euler characteristic',
    category: 'Geometry and topology',
    definition:
      'A number attached to a space, computed for a polyhedron as vertices minus edges plus faces, and unchanged by continuous deformation.',
    note: 'Every convex polyhedron gives V − E + F = 2, because each is topologically a sphere — the invariant belongs to the shape, not the subdivision. A torus gives 0 instead, so the quantity distinguishes surfaces that no amount of counting faces alone would.',
    seeAlso: ['topology', 'genus', 'planar-graph'],
    problems: [],
  },
  {
    slug: 'knot-theory',
    term: 'Knot theory',
    category: 'Geometry and topology',
    definition:
      'The study of closed loops embedded in three-dimensional space, considered equivalent when one can be deformed into the other without passing the loop through itself.',
    note: 'The loops must be closed. An open piece of string can always be untangled, so the mathematics only becomes interesting once the ends are joined. The central difficulty is proving two knots are different, which requires invariants — quantities preserved by deformation — since failing to find a deformation proves nothing.',
    seeAlso: ['topology', 'homeomorphism'],
    problems: [],
  },
  {
    slug: 'poincare-conjecture',
    term: 'Poincaré conjecture',
    category: 'Geometry and topology',
    definition:
      'The statement, now a theorem, that every closed simply connected three-dimensional manifold is homeomorphic to the three-sphere.',
    note: 'Simply connected means every loop can be shrunk to a point. Perelman proved it in preprints of 2002–2003 using Hamilton’s Ricci flow; verification completed by 2006. The Clay Institute awarded its Millennium Prize in 2010 and Perelman declined it — the problem is solved and the prize was awarded, it was simply refused.',
    seeAlso: ['manifold', 'topology', 'theorem'],
    problems: ['poincare-conjecture'],
  },

  // ------------------------------------------- graph theory & combinatorics
  {
    slug: 'graph',
    term: 'Graph',
    category: 'Graph theory and combinatorics',
    definition:
      'A set of vertices together with a set of edges, each edge joining a pair of vertices.',
    note: 'A graph need not be connected, and in this sense "graph" has nothing to do with the plotted curves the word usually names. Two vertices are adjacent when an edge joins them and connected when some path joins them — a distinction that is easy to blur and changes what several definitions mean.',
    seeAlso: ['chromatic-number', 'planar-graph', 'hamiltonian-path'],
    problems: [],
  },
  {
    slug: 'chromatic-number',
    term: 'Chromatic number',
    category: 'Graph theory and combinatorics',
    definition:
      'The smallest number of colours needed to colour a graph’s vertices so that no two adjacent vertices — vertices joined by an edge — share a colour.',
    note: 'Adjacent, not connected. Under the connected reading the answer for any connected graph would just be its vertex count, which is a different and far less interesting quantity: a path on five vertices has chromatic number 2, not 5. The four colour theorem states that every planar graph has chromatic number at most 4.',
    seeAlso: ['graph', 'planar-graph', 'ramsey-theory'],
    problems: [],
  },
  {
    slug: 'planar-graph',
    term: 'Planar graph',
    category: 'Graph theory and combinatorics',
    definition:
      'A graph that can be drawn in the plane with no two edges crossing.',
    note: 'Planarity is a property of the graph, not of a particular drawing — a graph is planar if some crossing-free drawing exists, however badly it is usually drawn. Kuratowski characterised planarity exactly: a graph is planar precisely when it contains no subdivision of the complete graph on five vertices or of the complete bipartite graph on three plus three.',
    seeAlso: ['graph', 'chromatic-number', 'euler-characteristic'],
    problems: [],
  },
  {
    slug: 'hamiltonian-path',
    term: 'Hamiltonian path',
    category: 'Graph theory and combinatorics',
    definition:
      'A path through a graph visiting every vertex exactly once. A Hamiltonian cycle additionally returns to its starting vertex.',
    note: 'Deciding whether one exists is NP-complete, which is the standard contrast with Eulerian paths — those traverse every edge once and admit a simple degree criterion checkable in linear time. Two problems that sound alike can sit on opposite sides of the tractability line.',
    seeAlso: ['graph', 'np-complete', 'p-versus-np'],
    problems: [],
  },
  {
    slug: 'ramsey-theory',
    term: 'Ramsey theory',
    category: 'Graph theory and combinatorics',
    definition:
      'The study of the order that must appear in any sufficiently large structure, however that structure is arranged.',
    note: 'Its slogan is that complete disorder is impossible. The results are typically existence statements with terrible bounds: R(5,5) is known only to lie between 43 and 46, and Erdős’s remark that humanity should sooner try to destroy an alien demanding R(6,6) than compute it is a fair summary of the difficulty.',
    seeAlso: ['pigeonhole-principle', 'graph', 'chromatic-number'],
    problems: ['ramsey-numbers'],
  },
  {
    slug: 'pigeonhole-principle',
    term: 'Pigeonhole principle',
    category: 'Graph theory and combinatorics',
    definition:
      'If more items are placed into containers than there are containers, then some container holds at least two items.',
    note: 'The strict inequality does all the work, and no finiteness assumption is needed: if every container held at most one item the placement would be injective, forcing the item count to be at most the container count. Despite being immediate, it is the engine behind a large number of nonconstructive proofs — it shows something exists without indicating where.',
    seeAlso: ['ramsey-theory', 'proof'],
    problems: [],
  },

  // ------------------------------------------- theoretical computer science
  {
    slug: 'algorithm',
    term: 'Algorithm',
    category: 'Theoretical computer science',
    definition:
      'A finite, precisely specified procedure that transforms an input into an output in a finite number of mechanical steps.',
    note: 'Making this informal notion precise was the achievement of the 1930s, via Turing machines, lambda calculus, and recursive functions — which all turned out to define the same class. That coincidence is the evidence for the Church–Turing thesis, and it is what lets undecidability be a theorem rather than an observation about current technique.',
    seeAlso: ['decision-problem', 'polynomial-time', 'undecidability'],
    problems: [],
  },
  {
    slug: 'decision-problem',
    term: 'Decision problem',
    category: 'Theoretical computer science',
    definition:
      'A computational problem whose answer for each input is yes or no.',
    note: 'Complexity classes such as P and NP are defined over decision problems specifically, which is why statements about them have to be phrased in those terms. It is rarely a real restriction: a search problem can usually be converted into a decision problem of comparable difficulty by asking whether a solution better than a given threshold exists.',
    seeAlso: ['p-versus-np', 'polynomial-time', 'undecidability'],
    problems: [],
  },
  {
    slug: 'polynomial-time',
    term: 'Polynomial time',
    category: 'Theoretical computer science',
    definition:
      'A running time bounded by some fixed power of the input size. Problems solvable this way form the class P and are treated as tractable.',
    note: 'The identification with "efficient" is a useful convention rather than a fact. An algorithm running in n¹⁰⁰ steps is polynomial and useless, while the simplex method is exponential in the worst case and excellent in practice. The convention earns its place because the class is robust: it does not change under reasonable changes of machine model.',
    seeAlso: ['p-versus-np', 'np-complete', 'algorithm', 'decision-problem'],
    problems: [],
  },
  {
    slug: 'p-versus-np',
    term: 'P versus NP',
    category: 'Theoretical computer science',
    definition:
      'The question of whether every decision problem whose yes-instances can be verified in polynomial time, given a suitable certificate, can also be decided in polynomial time.',
    note: 'The asymmetry is deliberate: NP concerns verifying yes-instances from a certificate, and whether no-instances are equally verifiable is the separate open question of NP versus co-NP. "Checked quickly" is shorthand for this certificate condition, not for checking a proposed answer in the everyday sense.',
    seeAlso: ['np-complete', 'polynomial-time', 'decision-problem'],
    problems: ['p-versus-np-problem'],
  },
  {
    slug: 'np-complete',
    term: 'NP-complete',
    category: 'Theoretical computer science',
    definition:
      'A problem in NP to which every other NP problem can be reduced in polynomial time, making it at least as hard as every problem in the class.',
    note: 'Completeness is what makes the class tractable to reason about: a polynomial-time algorithm for any single NP-complete problem would give one for all of them, and thereby prove P = NP. Thousands of problems across scheduling, logic and graph theory are known to be NP-complete, which is why the question is not confined to theory.',
    seeAlso: ['p-versus-np', 'polynomial-time', 'hamiltonian-path'],
    problems: ['p-versus-np-problem'],
  },

  // ----------------------------------------------------- dynamical systems
  {
    slug: 'dynamical-system',
    term: 'Dynamical system',
    category: 'Dynamical systems',
    definition:
      'A set of possible states together with a fixed rule determining how a state evolves over time.',
    note: 'The rule is deterministic, yet determinism does not imply predictability. Systems with sensitive dependence on initial conditions produce trajectories that diverge exponentially from starting points too close together to distinguish, which is why weather is deterministic in principle and unforecastable in practice beyond a couple of weeks. Time may be continuous, giving a differential equation, or discrete, giving repeated application of a map — the Collatz rule is a dynamical system in exactly this second sense.',
    seeAlso: ['orbit', 'attractor', 'ergodic-theory'],
    problems: [],
  },
  {
    slug: 'orbit',
    term: 'Orbit',
    category: 'Dynamical systems',
    definition:
      'The sequence or path of states produced by repeatedly applying a dynamical system’s rule to a given starting state.',
    note: 'Orbits can be periodic, eventually periodic, or neither, and which of those occurs can depend on the starting state in ways no formula captures. The Collatz conjecture is precisely a claim about orbits: that every positive integer’s orbit under its rule reaches the cycle containing 1. Note that it does not claim orbits are short. The orbit of 27 climbs to 9,232 and takes 111 steps, so any argument has to survive excursions far above the starting value.',
    seeAlso: ['dynamical-system', 'collatz-conjecture', 'attractor'],
    problems: ['collatz-conjecture'],
  },
  {
    slug: 'attractor',
    term: 'Attractor',
    category: 'Dynamical systems',
    definition:
      'A set of states that is invariant under the dynamics, attracts all nearby starting states over time, and contains no proper subset with both properties.',
    note: 'All three conditions are needed. Without invariance the set is not preserved by the dynamics; without attracting a whole neighbourhood, a single unstable point would qualify; without minimality, any set containing a genuine attractor would qualify too, including the entire state space.',
    seeAlso: ['dynamical-system', 'orbit', 'ergodic-theory'],
    problems: [],
  },
  {
    slug: 'ergodic-theory',
    term: 'Ergodic theory',
    category: 'Dynamical systems',
    definition:
      'The study of the long-run statistical behaviour of measure-preserving dynamical systems, where averages along a single trajectory can be compared with averages over the whole space.',
    note: 'A system is ergodic when those two averages agree for almost every starting point — time spent in a region matches that region’s size. This is what licenses replacing an intractable average over all states with the observation of one long trajectory, and it fails for systems that decompose into separate invariant pieces.',
    seeAlso: ['dynamical-system', 'attractor', 'orbit'],
    problems: [],
  },
];
