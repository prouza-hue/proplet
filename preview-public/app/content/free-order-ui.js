/* Compatibility hook for cached shells. The Play catalogue deliberately does
   not announce the next level; native Play/Continue owns that choice. Ordering
   preferences and the shared order engine remain unchanged. */
(function(root){'use strict';
root.PropletFreeOrderUI={mount(){}};
})(typeof globalThis!=='undefined'?globalThis:this);
