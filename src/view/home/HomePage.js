import xs from 'xstream';
import Snabbdom from 'snabbdom-pragma';

import css from './HomePage.css'

import { SearchBar } from './SearchBar.js';
import { ResultsContainer } from './ResultsContainer.js';

export function HomePage(sources) {
  const {
    DOM: searchBarVdom$,
    HTTP: searchBarHttp$,
    searchPhrase$,
    searchResponse$,
    isLoading$: searchIsLoading$,
    isError$: searchIsError$
  } = SearchBar(sources);

  const isDiscoveryMode$ =
    searchPhrase$
      .map(phrase => phrase.length === 0);

  const discoveryRequest$ =
    xs.of({
      url: sources.SvcUrl(`/movie/popular?language=en-US&page=1`),
      category: 'discovery',
      isRequest: true // duck typing :(
    })

  const discoveryResponse$ =
    sources.HTTP
      .select('discovery')
      .map(resp$ =>
        resp$.replaceError(err => xs.of(err))
      )
      .flatten()
      .map(resp => resp instanceof Error ? resp : JSON.parse(resp.text))
      .startWith('')

  const content$ =
    xs.combine(isDiscoveryMode$, searchResponse$, discoveryResponse$)
      .map(([isDiscoveryMode, searchResponse, discoveryResponse]) =>
        isDiscoveryMode
          ? discoveryResponse
          : searchResponse
      )
      .startWith('');

  const {
    DOM: resultsVdom$,
    resultsItemClick$
  } = ResultsContainer({
     ...sources,
     isLoading$: searchIsLoading$,
     isError$: searchIsError$,
     content$
  });

  const movieTitle$ =
    xs.combine(content$, resultsItemClick$)
      .map(([content, resultsItemClick]) => {
        const clickedItem =
          content.results &&
          content.results.find(
            item => item.id === Number(resultsItemClick.target.dataset.id)
          );

        return clickedItem ? clickedItem.title : '';
      });

  const vdom$ =
    xs.combine(searchBarVdom$, isDiscoveryMode$, searchPhrase$, resultsVdom$)
      .map(([searchBarVdom, isDiscoveryMode, searchPhrase, resultsVdom]) =>
        <div className="HomePage">
          <h1>TMDb UI – Home</h1>
          <legend className="uk-legend">Search for a Title:</legend>

          {searchBarVdom}

          <h3 className="uk-heading-bullet uk-margin-remove-top">
            {isDiscoveryMode
              ? 'Popular Now'
              : `Search Results for "${searchPhrase}":`}
          </h3>

          {resultsVdom}
        </div>
      );

  const http$ = xs.merge(
    searchBarHttp$,
    discoveryRequest$
  );

  const navigation$ =
    resultsItemClick$
      .map(event => `/movie/${event.target.closest('[data-id]').dataset.id}`);

  return {
    DOM: vdom$,
    HTTP: http$,
    history: navigation$,

    // See the comment in App.js
    movieTitle$
  };
}
