// Filter query grammar (peggy)
// Operator precedence (lowest to highest): | (or), & (and), ! (not), ( ... )

{
  function buildLeftAssoc(head, tail, type) {
    return tail.reduce((left, _arr) => ({ type: type, left: left, right: _arr[1] }), head);
  }
}

Start
  = _ expr:OrExpr _ { return expr; }

OrExpr
  = head:AndExpr tail:(_ "|" _ AndExpr)* {
      return buildLeftAssoc(head, tail.map(t => [t[1], t[3]]), 'or');
    }

AndExpr
  = head:NotExpr tail:(_ "&" _ NotExpr)* {
      return buildLeftAssoc(head, tail.map(t => [t[1], t[3]]), 'and');
    }

NotExpr
  = "!" _ inner:NotExpr { return { type: 'not', expr: inner }; }
  / Atom

Atom
  = "(" _ expr:OrExpr _ ")" { return expr; }
  / Operand

Operand
  = Project
  / Label
  / Priority
  / NoDate
  / Today
  / Overdue
  / DueBefore
  / DueAfter
  / DueOn
  / AssignedTo
  / TextTerm

Project
  = "#" name:Identifier { return { type: 'project', name: name }; }

Label
  = "@" name:Identifier { return { type: 'label', name: name }; }

Priority
  = [pP] level:[1-4] { return { type: 'priority', level: parseInt(level, 10) }; }

Today
  = "today"i !IdentChar { return { type: 'today' }; }

Overdue
  = "overdue"i !IdentChar { return { type: 'overdue' }; }

NoDate
  = "no"i __ "date"i !IdentChar { return { type: 'noDate' }; }

DueBefore
  = "due"i __ "before"i _ ":" _ date:ISODate { return { type: 'dueBefore', date: date }; }

DueAfter
  = "due"i __ "after"i _ ":" _ date:ISODate { return { type: 'dueAfter', date: date }; }

DueOn
  = "due"i _ ":" _ date:ISODate { return { type: 'dueOn', date: date }; }

AssignedTo
  = "assigned"i __ "to"i _ ":" _ target:(Me / Identifier) {
      return { type: 'assignedTo', user: target };
    }

Me
  = "me"i !IdentChar { return 'me'; }

TextTerm
  = '"' chars:QuotedChar* '"' { return { type: 'text', value: chars.join('') }; }

QuotedChar
  = '\\\\' { return '\\'; }
  / '\\"' { return '"'; }
  / [^"\\]

ISODate
  = digits:$([0-9][0-9][0-9][0-9] "-" [0-9][0-9] "-" [0-9][0-9]) { return digits; }

Identifier
  = chars:$(IdentChar+) { return chars; }

IdentChar
  = [a-zA-Z0-9_]

_ "optional whitespace"
  = [ \t]*

__ "whitespace"
  = [ \t]+
